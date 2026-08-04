import { createHmac, timingSafeEqual } from "crypto";
import { META_CLOUD_API_CONFIG } from "@/config/whatsapp";
import { createLogger } from "@/lib/logger";
import { MESSAGING_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { getTenantContext } from "@/lib/tenancy/context";
import { resolveTenantCredentials } from "@/lib/services/integrations/credentialResolver";
import { withRetry } from "../retry";
import type {
  WhatsAppProvider,
  WhatsAppRecipient,
  WhatsAppSendResult,
  WhatsAppTemplatePayload,
  WhatsAppWebhookChallenge,
  WhatsAppWebhookEvent,
  WhatsAppWebhookEventType,
  WhatsAppInboundMessage,
  MessageContentType,
  WhatsAppInteractiveButtonsPayload,
  WhatsAppInteractiveListPayload,
  WhatsAppMediaPayload,
  WhatsAppResolvedMedia,
  WhatsAppTemplateApprovalStatus,
  WhatsAppPhoneNumberHealth,
} from "../types";

const logger = createLogger({ service: "whatsapp", provider: "meta-cloud-api" });

/**
 * Real Meta WhatsApp Cloud API adapter. Field names/response shapes
 * below reflect Meta's long-documented Graph API conventions
 * (messaging_product/to/type/template/text envelope for sends;
 * entry/changes/value/statuses for webhooks) — verify against Meta's
 * current docs before relying on this in production, the same caveat
 * every vendor adapter in this module carries; Graph API versions do
 * introduce field-level changes over time.
 */

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${META_CLOUD_API_CONFIG.apiVersion}/${path}`;
}

/**
 * Business OS Phase 8, Module 8.2 — the outbound-send credentials this
 * organization should use for this call: its own tenant_secret
 * override (credentialResolver.ts) if configured, env config
 * otherwise. `apiVersion` is deliberately excluded — a Graph API
 * version pin is operational config, not a credential, and stays
 * env-only. Every async (outbound-request-making) method below
 * resolves this once at its own entry point rather than reading
 * META_CLOUD_API_CONFIG directly, the same "resolve once, use a local
 * var" shape openai/anthropic/gemini's own .complete() methods and
 * postmark.provider.ts's .send() already establish.
 *
 * Deliberately NOT applied to verifyWebhookChallenge/parseWebhookEvent/
 * parseInboundMessages/isValidSignature below: those are synchronous
 * (part of WhatsAppProvider's own interface contract, shared by every
 * vendor adapter) and, more fundamentally, inbound webhook signature
 * verification has to know WHICH organization's app secret to check
 * before it can even parse the payload to find out — this app has one
 * global `/api/webhooks/whatsapp` endpoint today with no per-tenant
 * routing segment, so there is no organizationId to resolve yet at
 * that point. Real per-tenant inbound WhatsApp app credentials need
 * genuine webhook-routing design (matching phoneNumberId -> connection
 * -> organization before signature verification), which is exactly the
 * kind of work Module 8.5 (WhatsApp Embedded Signup, explicitly out of
 * scope for 8.2) exists to do — disclosed here rather than silently
 * left inconsistent, the same posture Module 8.1's own inbound-webhook
 * default-org gap was disclosed with.
 */
async function resolveEffectiveConfig(): Promise<{ accessToken: string; phoneNumberId: string; businessAccountId: string }> {
  const organizationId = getTenantContext()?.organizationId;
  const overrides = organizationId ? await resolveTenantCredentials(organizationId, "whatsapp", ["accessToken", "phoneNumberId", "businessAccountId"]) : {};
  return {
    accessToken: overrides.accessToken ?? META_CLOUD_API_CONFIG.accessToken,
    phoneNumberId: overrides.phoneNumberId ?? META_CLOUD_API_CONFIG.phoneNumberId,
    businessAccountId: overrides.businessAccountId ?? META_CLOUD_API_CONFIG.businessAccountId,
  };
}

class MetaSendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "MetaSendError";
  }
}

interface MetaSendResponse {
  messages?: { id: string }[];
  error?: { message?: string; code?: number };
}

async function callMetaSendApi(body: Record<string, unknown>, config: { accessToken: string; phoneNumberId: string }): Promise<string> {
  const response = await fetch(graphUrl(`${config.phoneNumberId}/messages`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    signal: AbortSignal.timeout(MESSAGING_PROVIDER_TIMEOUT_MS),
  });

  const json = (await response.json().catch(() => null)) as MetaSendResponse | null;
  const messageId = json?.messages?.[0]?.id;

  if (!response.ok || !messageId) {
    const message = json?.error?.message ?? `Meta Cloud API request failed with status ${response.status}`;
    // 429 (rate limited) and 5xx (Meta-side transient failure) are worth
    // retrying; a 4xx like an invalid/unapproved template name is not —
    // retrying won't fix a malformed request.
    const retryable = response.status === 429 || response.status >= 500;
    throw new MetaSendError(String(json?.error?.code ?? response.status), message, retryable);
  }

  return messageId;
}

async function sendViaMeta(body: Record<string, unknown>): Promise<WhatsAppSendResult> {
  try {
    const config = await resolveEffectiveConfig();
    const providerMessageId = await withRetry(() => callMetaSendApi(body, config), {
      maxAttempts: 3,
      baseDelayMs: 500,
      // A thrown error that isn't our own MetaSendError is a network-level
      // failure (fetch itself rejected) — treat those as retryable too.
      isRetryable: (error) => (error instanceof MetaSendError ? error.retryable : true),
    });
    return { success: true, provider: "meta-cloud-api", providerMessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("whatsapp.send_failed", { message });
    return {
      success: false,
      provider: "meta-cloud-api",
      error: {
        code: error instanceof MetaSendError ? error.code : "network_error",
        message,
        retryable: error instanceof MetaSendError ? error.retryable : true,
        raw: error,
      },
    };
  }
}

/** Constant-time comparison — a naive === would leak timing information
 *  an attacker could use to guess the correct signature byte-by-byte. */
function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!META_CLOUD_API_CONFIG.appSecret) {
    // Fail closed: no secret configured means we cannot verify, so we
    // must reject rather than silently accept unverified webhooks.
    logger.warn("whatsapp.webhook_app_secret_not_configured");
    return false;
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", META_CLOUD_API_CONFIG.appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

interface MetaWebhookStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: { title?: string }[];
}

/** Module 2.2 (Rich Messaging) — Meta's shape for one inbound message
 *  inside `value.messages[]`, now covering every content type this app
 *  understands. Each vendor payload sub-object (image/video/location/
 *  etc.) is only present when `type` matches it — never more than one
 *  at a time. */
interface MetaWebhookMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
  /** Documents only. */
  filename?: string;
}

interface MetaWebhookLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

/** A vCard shared BY the contact as message content — distinct from
 *  MetaWebhookContact below, which is the sibling `value.contacts[]`
 *  array carrying the sender's own WhatsApp profile name. */
interface MetaWebhookSharedContact {
  name?: { formatted_name?: string };
  phones?: { phone?: string; wa_id?: string }[];
}

interface MetaWebhookInteractive {
  type: "button_reply" | "list_reply";
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

interface MetaWebhookReaction {
  message_id: string;
  emoji: string;
}

interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: MetaWebhookMedia;
  video?: MetaWebhookMedia;
  audio?: MetaWebhookMedia;
  document?: MetaWebhookMedia;
  location?: MetaWebhookLocation;
  contacts?: MetaWebhookSharedContact[];
  interactive?: MetaWebhookInteractive;
  reaction?: MetaWebhookReaction;
}

interface MetaWebhookContact {
  wa_id: string;
  profile?: { name?: string };
}

interface MetaWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        statuses?: MetaWebhookStatus[];
        messages?: MetaWebhookMessage[];
        contacts?: MetaWebhookContact[];
        /** Business OS Phase 8, Module 8.5 — Meta's own real, documented
         *  field identifying WHICH phone number this webhook delivery
         *  belongs to, present on every status/message payload
         *  regardless of tenant. This is the one fact
         *  app/api/webhooks/whatsapp/route.ts needs to resolve which
         *  organization owns this webhook BEFORE establishing tenant
         *  context for the rest of processing — see
         *  extractPhoneNumberId below and phoneNumberService
         *  .findByPhoneNumberId's own doc comment for the full routing
         *  chain. */
        metadata?: { phone_number_id?: string };
      };
    }[];
  }[];
}

const STATUS_MAP: Record<string, WhatsAppWebhookEventType> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

function extractStatusEvents(payload: MetaWebhookPayload): WhatsAppWebhookEvent[] {
  const events: WhatsAppWebhookEvent[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        const type = STATUS_MAP[status.status];
        if (!type) continue; // unrecognized status value — skip, don't throw
        events.push({
          type,
          providerMessageId: status.id,
          recipientPhoneE164: `+${status.recipient_id}`,
          timestamp: new Date(Number(status.timestamp) * 1000).toISOString(),
          errorMessage: status.errors?.[0]?.title,
        });
      }
    }
  }
  return events;
}

interface DescribedInboundContent {
  messageType: MessageContentType;
  body: string;
  mediaId?: string;
  mediaMimeType?: string;
  interactivePayload?: Record<string, unknown>;
}

/** Module 2.2 — turns one Meta webhook message into this app's
 *  vendor-agnostic content shape. Every branch produces a human-readable
 *  `body` even when the real content is structured (media/interactive/
 *  location/etc.) — the thread UI's list preview and any place that
 *  hasn't been taught to render a specific type both fall back to it
 *  safely. An unrecognized `type` (a Meta message kind this app hasn't
 *  been taught, e.g. a sticker) degrades to plain text rather than
 *  throwing — the same "skip, don't crash the webhook" posture
 *  extractStatusEvents already takes for an unrecognized status value. */
function describeInboundContent(message: MetaWebhookMessage): DescribedInboundContent {
  switch (message.type) {
    case "text":
      return { messageType: "text", body: message.text?.body ?? "" };
    case "image":
      return {
        messageType: "image",
        body: message.image?.caption || "📷 Photo",
        mediaId: message.image?.id,
        mediaMimeType: message.image?.mime_type,
      };
    case "video":
      return {
        messageType: "video",
        body: message.video?.caption || "🎥 Video",
        mediaId: message.video?.id,
        mediaMimeType: message.video?.mime_type,
      };
    case "audio":
      return {
        messageType: "audio",
        body: "🎤 Voice message",
        mediaId: message.audio?.id,
        mediaMimeType: message.audio?.mime_type,
      };
    case "document":
      return {
        messageType: "document",
        body: message.document?.caption || message.document?.filename || "📄 Document",
        mediaId: message.document?.id,
        mediaMimeType: message.document?.mime_type,
      };
    case "location":
      return {
        messageType: "location",
        body: message.location?.name || message.location?.address || "📍 Shared a location",
        interactivePayload: message.location ? { ...message.location } : undefined,
      };
    case "contacts": {
      const names = (message.contacts ?? []).map((c) => c.name?.formatted_name).filter(Boolean);
      return {
        messageType: "contacts",
        body: names.length > 0 ? `👤 Shared contact: ${names.join(", ")}` : "👤 Shared a contact",
        interactivePayload: { contacts: message.contacts ?? [] },
      };
    }
    case "interactive": {
      if (message.interactive?.type === "button_reply" && message.interactive.button_reply) {
        const { id, title } = message.interactive.button_reply;
        return { messageType: "button_reply", body: `Tapped: ${title}`, interactivePayload: { id, title } };
      }
      if (message.interactive?.type === "list_reply" && message.interactive.list_reply) {
        const { id, title, description } = message.interactive.list_reply;
        return { messageType: "list_reply", body: `Selected: ${title}`, interactivePayload: { id, title, description } };
      }
      return { messageType: "text", body: "[interactive]" };
    }
    case "reaction":
      return {
        messageType: "reaction",
        body: message.reaction?.emoji ? `Reacted ${message.reaction.emoji}` : "Reacted",
        interactivePayload: message.reaction
          ? { emoji: message.reaction.emoji, reactedToProviderMessageId: message.reaction.message_id }
          : undefined,
      };
    default:
      return { messageType: "text", body: `[${message.type}]` };
  }
}

/** WhatsApp Platform (Phase 2) — the `messages[]` half of the same
 *  webhook payload `extractStatusEvents` reads the `statuses[]` half
 *  of. `contacts[]` carries the sender's profile name, matched to a
 *  message by `wa_id` (same value as `messages[].from`) — Meta sends
 *  them as sibling arrays under the same `value`, not nested. Module
 *  2.2 extends this from text-only to every content type Meta sends via
 *  describeInboundContent above. */
function extractInboundMessages(payload: MetaWebhookPayload): WhatsAppInboundMessage[] {
  const inbound: WhatsAppInboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const contactNameByWaId = new Map<string, string>();
      for (const contact of change.value?.contacts ?? []) {
        if (contact.profile?.name) contactNameByWaId.set(contact.wa_id, contact.profile.name);
      }
      for (const message of change.value?.messages ?? []) {
        const content = describeInboundContent(message);
        inbound.push({
          providerMessageId: message.id,
          fromPhoneE164: `+${message.from}`,
          contactName: contactNameByWaId.get(message.from),
          ...content,
          timestamp: new Date(Number(message.timestamp) * 1000).toISOString(),
        });
      }
    }
  }
  return inbound;
}

export const metaCloudApiProvider: WhatsAppProvider = {
  id: "meta-cloud-api",

  async sendText(recipient: WhatsAppRecipient, body: string): Promise<WhatsAppSendResult> {
    logger.info("whatsapp.send_text", { to: recipient.phoneE164 });
    return sendViaMeta({ to: recipient.phoneE164, type: "text", text: { body } });
  },

  async sendTemplate(
    recipient: WhatsAppRecipient,
    payload: WhatsAppTemplatePayload,
  ): Promise<WhatsAppSendResult> {
    logger.info("whatsapp.send_template", { to: recipient.phoneE164, template: payload.templateName });
    return sendViaMeta({
      to: recipient.phoneE164,
      type: "template",
      template: {
        name: payload.templateName,
        language: { code: payload.languageCode },
        components: [
          {
            type: "body",
            parameters: payload.variables.map((value) => ({ type: "text", text: value })),
          },
        ],
      },
    });
  },

  verifyWebhookChallenge(challenge: WhatsAppWebhookChallenge): string | null {
    const verified =
      challenge.mode === "subscribe" &&
      !!challenge.verifyToken &&
      !!META_CLOUD_API_CONFIG.webhookVerifyToken &&
      challenge.verifyToken === META_CLOUD_API_CONFIG.webhookVerifyToken;

    if (!verified) {
      logger.warn("whatsapp.webhook_verification_failed", { mode: challenge.mode });
      return null;
    }
    return challenge.challenge;
  },

  parseWebhookEvent(rawBody: string, signatureHeader: string | null): WhatsAppWebhookEvent[] | null {
    if (!isValidSignature(rawBody, signatureHeader)) {
      logger.warn("whatsapp.webhook_signature_invalid");
      return null;
    }

    try {
      const payload = JSON.parse(rawBody) as MetaWebhookPayload;
      return extractStatusEvents(payload);
    } catch (error) {
      logger.warn("whatsapp.webhook_parse_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },

  parseInboundMessages(rawBody: string, signatureHeader: string | null): WhatsAppInboundMessage[] | null {
    if (!isValidSignature(rawBody, signatureHeader)) {
      logger.warn("whatsapp.webhook_signature_invalid");
      return null;
    }

    try {
      const payload = JSON.parse(rawBody) as MetaWebhookPayload;
      return extractInboundMessages(payload);
    } catch (error) {
      logger.warn("whatsapp.webhook_parse_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },

  async sendInteractiveButtons(
    recipient: WhatsAppRecipient,
    payload: WhatsAppInteractiveButtonsPayload,
  ): Promise<WhatsAppSendResult> {
    logger.info("whatsapp.send_interactive_buttons", { to: recipient.phoneE164, buttonCount: payload.buttons.length });
    return sendViaMeta({
      to: recipient.phoneE164,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: payload.bodyText },
        // Meta caps quick-reply titles at 20 characters — truncated here
        // rather than rejected, since a caller-side length check would
        // just duplicate this same limit; an over-limit send fails loud
        // via sendViaMeta's normal error path either way.
        action: {
          buttons: payload.buttons
            .slice(0, 3)
            .map((button) => ({ type: "reply", reply: { id: button.id, title: button.title.slice(0, 20) } })),
        },
      },
    });
  },

  async sendInteractiveList(
    recipient: WhatsAppRecipient,
    payload: WhatsAppInteractiveListPayload,
  ): Promise<WhatsAppSendResult> {
    logger.info("whatsapp.send_interactive_list", { to: recipient.phoneE164, sectionCount: payload.sections.length });
    return sendViaMeta({
      to: recipient.phoneE164,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: payload.bodyText },
        action: {
          button: payload.buttonText,
          sections: payload.sections.map((section) => ({
            title: section.title,
            rows: section.rows.map((row) => ({ id: row.id, title: row.title, description: row.description })),
          })),
        },
      },
    });
  },

  async sendMedia(recipient: WhatsAppRecipient, payload: WhatsAppMediaPayload): Promise<WhatsAppSendResult> {
    logger.info("whatsapp.send_media", { to: recipient.phoneE164, kind: payload.kind });
    return sendViaMeta({
      to: recipient.phoneE164,
      type: payload.kind,
      [payload.kind]: {
        link: payload.url,
        caption: payload.caption,
        // Meta only recognizes `filename` on document sends — harmless
        // to omit for the other three kinds since it's undefined there.
        ...(payload.kind === "document" ? { filename: payload.filename } : {}),
      },
    });
  },

  async resolveMediaUrl(mediaId: string): Promise<WhatsAppResolvedMedia | null> {
    try {
      const { accessToken } = await resolveEffectiveConfig();
      const response = await fetch(graphUrl(mediaId), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(MESSAGING_PROVIDER_TIMEOUT_MS),
      });
      const json = (await response.json().catch(() => null)) as { url?: string; mime_type?: string } | null;
      if (!response.ok || !json?.url) {
        logger.warn("whatsapp.media_resolve_failed", { mediaId, status: response.status });
        return null;
      }
      return {
        url: json.url,
        mimeType: json.mime_type ?? "application/octet-stream",
        // The URL Meta returns is itself auth-gated — the same bearer
        // token used for this lookup is required to fetch the bytes.
        fetchHeaders: { Authorization: `Bearer ${accessToken}` },
      };
    } catch (error) {
      logger.warn("whatsapp.media_resolve_failed", { mediaId, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /** Module 2.3 — Meta's template-list endpoint is scoped to the WABA
   *  (businessAccountId), not the phone number — one WABA can own
   *  several numbers, but templates are shared account-wide. */
  async listTemplateApprovalStatuses(): Promise<WhatsAppTemplateApprovalStatus[] | null> {
    const { accessToken, businessAccountId } = await resolveEffectiveConfig();
    if (!businessAccountId) {
      logger.warn("whatsapp.template_sync_not_configured");
      return null;
    }
    try {
      const response = await fetch(
        graphUrl(`${businessAccountId}/message_templates?fields=name,status&limit=200`),
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(MESSAGING_PROVIDER_TIMEOUT_MS) },
      );
      const json = (await response.json().catch(() => null)) as
        | { data?: { name?: string; status?: string }[] }
        | null;
      if (!response.ok || !json?.data) {
        logger.warn("whatsapp.template_sync_failed", { status: response.status });
        return null;
      }
      return json.data
        .filter((entry): entry is { name: string; status: string } => typeof entry.name === "string" && typeof entry.status === "string")
        .map((entry) => ({
          metaTemplateName: entry.name,
          status: normalizeTemplateStatus(entry.status),
        }));
    } catch (error) {
      logger.warn("whatsapp.template_sync_failed", { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /** Module 2.3 — `quality_rating` is a real, documented field on a
   *  phone number node; `messaging_limit_tier` is requested too but
   *  treated as optional in the response mapping below — confirm the
   *  exact field name against Meta's current docs once a real Business
   *  Account is connected, the same "verify before production" caveat
   *  this file's own top-of-file comment already carries for every
   *  field shape in it. */
  async getPhoneNumberHealth(): Promise<WhatsAppPhoneNumberHealth | null> {
    const { accessToken, phoneNumberId } = await resolveEffectiveConfig();
    if (!phoneNumberId) return null;
    try {
      const response = await fetch(
        graphUrl(`${phoneNumberId}?fields=display_phone_number,quality_rating,messaging_limit_tier`),
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(MESSAGING_PROVIDER_TIMEOUT_MS) },
      );
      const json = (await response.json().catch(() => null)) as
        | { display_phone_number?: string; quality_rating?: string; messaging_limit_tier?: string }
        | null;
      if (!response.ok || !json) {
        logger.warn("whatsapp.phone_health_check_failed", { status: response.status });
        return null;
      }
      return {
        phoneNumberId,
        displayPhoneNumber: json.display_phone_number,
        qualityRating: normalizeQualityRating(json.quality_rating),
        messagingLimit: json.messaging_limit_tier,
      };
    } catch (error) {
      logger.warn("whatsapp.phone_health_check_failed", { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },
};

// Exported (not just used internally) so their mapping decisions —
// "anything not a terminal APPROVED/REJECTED defaults to pending," "an
// unrecognized quality_rating value degrades to unknown, never a wrong
// color" — are locked in by a direct unit test, not only exercised
// incidentally through a live Graph API call this environment has no
// real credentials to make.
export function normalizeTemplateStatus(raw: string): WhatsAppTemplateApprovalStatus["status"] {
  const value = raw.toUpperCase();
  if (value === "APPROVED") return "approved";
  if (value === "REJECTED") return "rejected";
  return "pending"; // PENDING, IN_APPEAL, PAUSED, etc. — anything not a terminal approve/reject
}

/**
 * Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup's own
 * critical requirement: "the platform must reliably determine which
 * organization owns the WABA/Phone Number" for every inbound webhook,
 * before any tenant context exists. `value.metadata.phone_number_id` is
 * present on every real Meta webhook delivery (status or message)
 * regardless of tenant — this function is the one place that field is
 * extracted, deliberately BEFORE/INDEPENDENT of signature verification
 * (the caller — app/api/webhooks/whatsapp/route.ts — only trusts the
 * result after `parseWebhookEvent`/`parseInboundMessages` have already
 * confirmed the signature; this function itself does no verification,
 * matching `extractStatusEvents`/`extractInboundMessages`'s own
 * "parse, don't verify, that's the caller's job" shape). Returns `null`
 * for malformed JSON or a payload with no recognizable phone number id
 * — the caller falls back to this deployment's own default-organization
 * routing, unchanged from Module 8.1's own disclosed posture.
 */
export function extractPhoneNumberId(rawBody: string): string | null {
  try {
    const payload = JSON.parse(rawBody) as MetaWebhookPayload;
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id;
        if (phoneNumberId) return phoneNumberId;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizeQualityRating(raw: string | undefined): WhatsAppPhoneNumberHealth["qualityRating"] {
  const value = (raw ?? "").toUpperCase();
  if (value === "GREEN" || value === "YELLOW" || value === "RED") return value.toLowerCase() as "green" | "yellow" | "red";
  return "unknown";
}

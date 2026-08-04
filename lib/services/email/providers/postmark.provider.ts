import { POSTMARK_CONFIG } from "@/config/emailChannel";
import { createLogger } from "@/lib/logger";
import { getTenantContext } from "@/lib/tenancy/context";
import { EMAIL_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { resolveTenantCredentials } from "@/lib/services/integrations/credentialResolver";
import { withRetry } from "../retry";
import type { EmailProvider, EmailRecipient, EmailSendPayload, EmailSendResult, EmailInboundMessage } from "../types";

const logger = createLogger({ service: "email", provider: "postmark" });

/**
 * Real Postmark adapter. Field names/response shapes below reflect
 * Postmark's long-documented Server API (Send) and Inbound Webhook
 * conventions — verify against Postmark's current docs before relying
 * on this in production, the same caveat every vendor adapter in this
 * codebase carries (see lib/services/whatsapp/providers/metaCloudApi.provider.ts).
 *
 * Chosen over SendGrid/Resend as the one fully-implemented vendor for
 * two concrete reasons, not arbitrarily: (1) Postmark's Send API is a
 * single JSON POST authenticated with a server token header — no SDK
 * needed, same "raw fetch, no vendor SDK dependency" posture the Meta
 * Cloud API adapter already established; (2) Postmark's Inbound Stream
 * delivers already-MIME-parsed JSON (From/Subject/TextBody/HtmlBody
 * fields ready to use) rather than raw MIME requiring a parsing
 * library this repo doesn't have installed — the same reason it was
 * the lower-risk pick for the inbound half of this module.
 *
 * Postmark's inbound webhooks are NOT HMAC-signed by default (unlike
 * Meta's X-Hub-Signature-256) — the vendor's own documented practice is
 * a shared secret embedded in the webhook URL itself
 * (POSTMARK_CONFIG.inboundWebhookToken, checked as a `?token=` query
 * param by the caller — see app/api/webhooks/email/route.ts), not a
 * body signature this adapter can verify on its own. `parseInboundEmails`
 * still takes a second "signature-like" parameter for interface
 * symmetry with WhatsAppProvider.parseInboundMessages, but the actual
 * secret comparison happens in the route (it has the query string;
 * this adapter only sees the raw body).
 */

class PostmarkSendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PostmarkSendError";
  }
}

interface PostmarkSendResponse {
  MessageID?: string;
  ErrorCode?: number;
  Message?: string;
}

async function callPostmarkSendApi(body: Record<string, unknown>, serverToken: string): Promise<string> {
  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": serverToken,
    },
    body: JSON.stringify({ MessageStream: "outbound", ...body }),
    signal: AbortSignal.timeout(EMAIL_PROVIDER_TIMEOUT_MS),
  });

  const json = (await response.json().catch(() => null)) as PostmarkSendResponse | null;
  const messageId = json?.MessageID;
  const errorCode = json?.ErrorCode ?? 0;

  if (!response.ok || errorCode !== 0 || !messageId) {
    const message = json?.Message ?? `Postmark request failed with status ${response.status}`;
    // 429 (rate limited) and 5xx (Postmark-side transient failure) are
    // worth retrying; a validation-shaped ErrorCode (bad address,
    // unverified sender signature) is not — retrying won't fix a
    // malformed request, the same distinction sendViaMeta's own
    // retryable flag draws.
    const retryable = response.status === 429 || response.status >= 500;
    throw new PostmarkSendError(String(errorCode || response.status), message, retryable);
  }

  return messageId;
}

async function sendViaPostmark(body: Record<string, unknown>, serverToken: string): Promise<EmailSendResult> {
  try {
    const providerMessageId = await withRetry(() => callPostmarkSendApi(body, serverToken), {
      maxAttempts: 3,
      baseDelayMs: 500,
      isRetryable: (error) => (error instanceof PostmarkSendError ? error.retryable : true),
    });
    return { success: true, provider: "postmark", providerMessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("email.send_failed", { message });
    return {
      success: false,
      provider: "postmark",
      error: {
        code: error instanceof PostmarkSendError ? error.code : "network_error",
        message,
        retryable: error instanceof PostmarkSendError ? error.retryable : true,
        raw: error,
      },
    };
  }
}

/** Postmark's Inbound Webhook JSON shape — already parsed from the raw
 *  MIME message on Postmark's side, unlike Meta's webhook which this
 *  app parses itself. Only the fields this app actually reads are
 *  declared; Postmark's real payload carries many more (Attachments,
 *  Headers, CC, BCC, etc.) that this module doesn't yet consume — a
 *  disclosed v1 boundary (see CHANGELOG.md), not an oversight. */
interface PostmarkInboundPayload {
  MessageID: string;
  FromFull?: { Email: string; Name?: string };
  From?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  Date?: string;
}

export const postmarkProvider: EmailProvider = {
  id: "postmark",

  async send(recipient: EmailRecipient, payload: EmailSendPayload): Promise<EmailSendResult> {
    // Business OS Phase 8, Module 8.2 — the current organization's own
    // tenant_secret credentials (its own Postmark server token AND its
    // own verified "From" sender address — a real per-tenant business
    // fact, not just a secret) win over env config when present. See
    // openai.provider.ts's own doc comment for why `getTenantContext()`
    // is read directly here rather than an organizationId parameter.
    const organizationId = getTenantContext()?.organizationId;
    const overrides = organizationId ? await resolveTenantCredentials(organizationId, "email", ["serverToken", "fromAddress"]) : {};
    const serverToken = overrides.serverToken ?? POSTMARK_CONFIG.serverToken;
    const fromAddress = overrides.fromAddress ?? POSTMARK_CONFIG.fromAddress;

    logger.info("email.send", { to: recipient.email, subject: payload.subject });
    return sendViaPostmark(
      {
        From: fromAddress,
        To: recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email,
        Subject: payload.subject,
        TextBody: payload.bodyText,
        HtmlBody: payload.bodyHtml,
      },
      serverToken,
    );
  },

  parseInboundEmails(rawBody: string): EmailInboundMessage[] | null {
    // Token verification happens in the route (it has the query
    // string this adapter never sees) — by the time this runs, the
    // caller has already established the request is authentic.
    try {
      const payload = JSON.parse(rawBody) as PostmarkInboundPayload;
      const fromEmail = payload.FromFull?.Email ?? payload.From;
      if (!fromEmail) {
        logger.warn("email.webhook_parse_missing_from");
        return null;
      }
      return [
        {
          providerMessageId: payload.MessageID,
          fromEmail,
          fromName: payload.FromFull?.Name,
          subject: payload.Subject ?? "(no subject)",
          bodyText: payload.TextBody ?? "",
          bodyHtml: payload.HtmlBody,
          timestamp: payload.Date ? new Date(payload.Date).toISOString() : new Date().toISOString(),
        },
      ];
    } catch (error) {
      logger.warn("email.webhook_parse_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },
};

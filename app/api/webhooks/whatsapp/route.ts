import { NextResponse } from "next/server";
import { withApiRoute } from "@/lib/api";
import { whatsappService } from "@/lib/services/whatsapp";
import type { WhatsAppWebhookEvent, WhatsAppInboundMessage } from "@/lib/services/whatsapp";
import { extractPhoneNumberId } from "@/lib/services/whatsapp/providers/metaCloudApi.provider";
import { phoneNumberService } from "@/lib/services/whatsapp/phoneNumbers";
import { getMessageRepository, getWhatsAppCampaignRepository } from "@/lib/db";
import { checkCampaignCompletion } from "@/lib/services/whatsappCampaigns";
import { conversationService } from "@/lib/services/conversations";
import { webhookMonitoringService } from "@/lib/services/webhookMonitoring";
import { publish } from "@/lib/events";
import { createLogger } from "@/lib/logger";
import { runWithTenantContext } from "@/lib/tenancy/context";

/** Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 *  event bus's own event type per WhatsApp status, named
 *  "whatsapp.message.*" to distinguish from this route's own inbound
 *  "message.received" (Module 2.1), a different occurrence entirely
 *  (a status update about a message THIS app sent, not a new inbound
 *  message). */
const STATUS_EVENT_TYPE: Record<string, string> = {
  sent: "whatsapp.message.sent",
  delivered: "whatsapp.message.delivered",
  read: "whatsapp.message.read",
  failed: "whatsapp.message.failed",
};

const logger = createLogger({ service: "whatsapp.webhook" });

/** Only meaningful ordering among the non-terminal statuses — used to
 *  ignore a duplicate/out-of-order webhook delivery (e.g. a "read"
 *  arriving, then a re-delivered "delivered" for the same message)
 *  rather than regress a Message's status backward. "failed" is
 *  handled separately since it's terminal regardless of rank. */
const STATUS_RANK: Record<string, number> = { queued: 0, sending: 0, sent: 1, delivered: 2, read: 3 };

/**
 * Campaign Architecture — the one new responsibility this webhook
 * gains: looking up the Message a status event belongs to (by
 * `providerMessageId`, set when the message-send job handler records a
 * successful send) and updating its status/timestamp, plus the owning
 * campaign's denormalized rollup counters. A status event for a
 * providerMessageId this app doesn't recognize (a message sent outside
 * the Campaign Manager, e.g. today's other whatsappService call sites)
 * is a no-op — not every WhatsApp send is a campaign message.
 *
 * `sentCount` is deliberately never incremented here: the message-send
 * job handler already increments it synchronously right after a
 * successful send call, before any webhook could arrive — doing it
 * again here on a "sent" event would double-count it.
 */
async function applyStatusEvent(event: WhatsAppWebhookEvent): Promise<void> {
  const messageRepository = await getMessageRepository();
  const message = await messageRepository.findByProviderMessageId(event.providerMessageId);
  if (!message) return;

  if (event.type === "failed") {
    if (message.status === "failed") return; // already recorded — e.g. by the job handler itself
    await messageRepository.update(message.id, {
      status: "failed",
      failedAt: event.timestamp,
      failureReason: event.errorMessage ?? "Delivery failed",
    });
    if (message.campaignId) {
      const campaignRepository = await getWhatsAppCampaignRepository();
      await campaignRepository.incrementCounts(message.campaignId, { failedCount: 1 });
      await checkCampaignCompletion(message.campaignId);
    }
    await publish(STATUS_EVENT_TYPE.failed, { messageId: message.id, providerMessageId: event.providerMessageId, campaignId: message.campaignId, errorMessage: event.errorMessage });
    return;
  }

  const currentRank = STATUS_RANK[message.status] ?? 0;
  const newRank = STATUS_RANK[event.type] ?? 0;
  if (newRank <= currentRank) return;

  const patch: { status: WhatsAppWebhookEvent["type"]; sentAt?: string; deliveredAt?: string; readAt?: string } = {
    status: event.type,
  };
  if (event.type === "sent") patch.sentAt = event.timestamp;
  if (event.type === "delivered") patch.deliveredAt = event.timestamp;
  if (event.type === "read") patch.readAt = event.timestamp;
  await messageRepository.update(message.id, patch);

  if (message.campaignId && event.type !== "sent") {
    const campaignRepository = await getWhatsAppCampaignRepository();
    const field = event.type === "delivered" ? "deliveredCount" : "readCount";
    await campaignRepository.incrementCounts(message.campaignId, { [field]: 1 });
  }

  const eventType = STATUS_EVENT_TYPE[event.type];
  if (eventType) {
    await publish(eventType, { messageId: message.id, providerMessageId: event.providerMessageId, campaignId: message.campaignId });
  }
}

/**
 * GET /api/webhooks/whatsapp
 *
 * The vendor's one-time webhook-setup verification handshake, configured
 * once in the Meta App Dashboard when the webhook URL is registered.
 * Echoes back `hub.challenge` if `hub.verify_token` matches
 * WHATSAPP_META_WEBHOOK_VERIFY_TOKEN, otherwise rejects with 403.
 */
async function handleVerification(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  const result = whatsappService.verifyWebhookChallenge({
    mode: searchParams.get("hub.mode"),
    verifyToken: searchParams.get("hub.verify_token"),
    challenge: searchParams.get("hub.challenge"),
  });

  if (result === null) {
    logger.warn("whatsapp.webhook_get_rejected");
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Meta expects the raw challenge string echoed back as the response
  // body — not JSON.
  return new NextResponse(result, { status: 200 });
}

/**
 * POST /api/webhooks/whatsapp
 *
 * Inbound delivery/read/failed status updates. Verifies the
 * X-Hub-Signature-256 HMAC header against the exact raw request body
 * before trusting anything in it — see
 * providers/metaCloudApi.provider.ts's parseWebhookEvent(). Rejects with
 * 401 on an invalid/missing signature rather than silently swallowing
 * it: a genuine misconfiguration (wrong app secret) should surface as
 * repeated failures, not disappear silently.
 *
 * Every event is still logged as before (this pipeline's operational
 * visibility hasn't changed) — Campaign Architecture adds
 * `applyStatusEvent()` alongside that, persisting the event against
 * whichever Message row it belongs to instead of only logging it (the
 * gap WHATSAPP_ARCHITECTURE.md's audit originally flagged).
 *
 * WhatsApp Platform (Phase 2) adds a second pass over the same body:
 * `statuses[]` (existing, above) and `messages[]` (new) are sibling
 * arrays in the same Meta payload — a single inbound webhook delivery
 * can legitimately carry either, both, or neither. Both parses run
 * unconditionally; each is a no-op if that half of the payload is
 * absent, so this is safe even against a status-only or message-only
 * delivery.
 *
 * Responds quickly and does no slow work in-line — Meta retries with
 * backoff if this endpoint doesn't return 200 promptly.
 */
/** Module 2.4 (Webhook & API Monitoring) — best-effort by design: a
 *  failure writing this log must never turn an otherwise-successful
 *  webhook delivery into a 500, which would make Meta retry a delivery
 *  this app already finished handling. Same "record the side effect,
 *  never let it fail the primary action" posture as
 *  leadService.registerLead()'s own assignmentService call. */
async function recordDelivery(input: Parameters<typeof webhookMonitoringService.logDelivery>[0]): Promise<void> {
  await webhookMonitoringService.logDelivery(input).catch((error) => {
    logger.error("whatsapp.webhook_delivery_log_failed", { error: error instanceof Error ? error.message : String(error) });
  });
}

/**
 * Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup's own
 * critical requirement: "the platform must reliably determine which
 * organization owns the WABA/Phone Number" for every inbound webhook.
 * Signature verification (inside `parseWebhookEvent`/`parseInboundMessages`
 * above) stays platform-level and unchanged — a real Embedded Signup
 * deployment has exactly ONE Meta App, shared across every tenant's own
 * WABA via System User permissions, so ONE app secret correctly verifies
 * every tenant's webhook deliveries. What's NEW here is routing: after
 * the signature is trusted, `extractPhoneNumberId` reads Meta's own
 * `metadata.phone_number_id` field and `phoneNumberService
 * .findByPhoneNumberId` resolves which organization connected that
 * number (Module 8.5's own routing table, itself an extension of
 * Module 2.3's existing phone-health record — see that service's own
 * doc comment). Everything downstream of that resolution runs inside
 * `runWithTenantContext`, so `applyStatusEvent`'s repository calls and
 * `conversationService.recordInboundMessage` land correctly scoped to
 * THAT organization — never the ambient default. An unrecognized number
 * (this deployment's own pre-8.5 default number, or a payload from a
 * differently-shaped non-Meta provider) falls through to the existing,
 * unchanged default-organization behavior — Module 8.1's own disclosed
 * posture, not a regression.
 */
async function processWebhookPayload(events: WhatsAppWebhookEvent[], inboundMessages: (WhatsAppInboundMessage & { channel: "whatsapp" })[]): Promise<void> {
  for (const event of events) {
    logger.info("whatsapp.status_event", {
      type: event.type,
      providerMessageId: event.providerMessageId,
      recipient: event.recipientPhoneE164,
      errorMessage: event.errorMessage,
    });
    await applyStatusEvent(event);
  }

  for (const message of inboundMessages) {
    logger.info("whatsapp.message_received", {
      providerMessageId: message.providerMessageId,
      from: message.fromPhoneE164,
    });
    // Module 2.2 (Rich Messaging) — recordInboundMessage now takes the
    // full normalized WhatsAppInboundMessage (every content type, plus
    // media/interactive metadata) rather than a narrow {body} shape.
    await conversationService.recordInboundMessage(message);
  }

  await recordDelivery(
    events.length + inboundMessages.length === 0
      ? { source: "whatsapp", outcome: "unrecognized", eventCount: 0, detail: "Signature verified, but the payload carried no recognized status events or messages." }
      : {
          source: "whatsapp",
          outcome: "processed",
          eventCount: events.length + inboundMessages.length,
          detail: `${events.length} status event${events.length === 1 ? "" : "s"}, ${inboundMessages.length} inbound message${inboundMessages.length === 1 ? "" : "s"}.`,
        },
  );
}

async function handleStatusEvent(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  const events = whatsappService.parseWebhookEvent(rawBody, signature);
  if (events === null) {
    logger.warn("whatsapp.webhook_post_rejected");
    await recordDelivery({
      source: "whatsapp",
      outcome: "signature_invalid",
      eventCount: 0,
      detail: "Invalid or missing X-Hub-Signature-256 — payload was not trusted.",
    });
    return NextResponse.json({ received: false }, { status: 401 });
  }
  const inboundMessages = whatsappService.parseInboundMessages(rawBody, signature) ?? [];

  // Business OS Phase 8, Module 8.5 — resolve which organization owns
  // this webhook BEFORE processing it, so every downstream write
  // (applyStatusEvent, recordInboundMessage, recordDelivery) lands
  // correctly tenant-scoped. See this function's own doc comment above
  // processWebhookPayload for the full routing chain.
  const phoneNumberId = extractPhoneNumberId(rawBody);
  const route = phoneNumberId ? await phoneNumberService.findByPhoneNumberId(phoneNumberId) : null;

  if (route?.organizationId) {
    await runWithTenantContext({ organizationId: route.organizationId }, () =>
      processWebhookPayload(events, inboundMessages.map((m) => ({ ...m, channel: "whatsapp" as const }))),
    );
  } else {
    await processWebhookPayload(events, inboundMessages.map((m) => ({ ...m, channel: "whatsapp" as const })));
  }

  return NextResponse.json({ received: true, count: events.length, messageCount: inboundMessages.length }, { status: 200 });
}

export const GET = withApiRoute("whatsapp.webhook.verify", handleVerification, {
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const POST = withApiRoute("whatsapp.webhook.receive", handleStatusEvent, {
  // Generous — Meta can legitimately deliver many status events in quick
  // succession after a burst of outbound sends (e.g. a batch of
  // reminders), unlike the public-facing lead/campaign/registration
  // routes which expect one-at-a-time human traffic.
  rateLimit: { limit: 300, windowMs: 60_000 },
});

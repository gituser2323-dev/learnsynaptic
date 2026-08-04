import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { withApiRoute } from "@/lib/api";
import { emailService } from "@/lib/services/email";
import { POSTMARK_CONFIG } from "@/config/emailChannel";
import { conversationService } from "@/lib/services/conversations";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "email.webhook" });

/** Constant-time comparison against the configured shared secret — the
 *  same "don't leak timing information" reasoning
 *  metaCloudApi.provider.ts's isValidSignature already applies to its
 *  HMAC check, just against a plain token instead of a digest (see
 *  POSTMARK_CONFIG.inboundWebhookToken's own doc comment on why
 *  Postmark's inbound webhooks use a URL-embedded secret rather than a
 *  signature header). Fails closed: no secret configured means this
 *  can never verify, so every request is rejected rather than silently
 *  accepted. */
function isAuthorized(token: string | null): boolean {
  if (!POSTMARK_CONFIG.inboundWebhookToken) {
    logger.warn("email.webhook_token_not_configured");
    return false;
  }
  if (!token) return false;

  const expected = Buffer.from(POSTMARK_CONFIG.inboundWebhookToken);
  const provided = Buffer.from(token);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/**
 * POST /api/webhooks/email?token=...
 *
 * Module 4.2 (Email Channel Integration) — Postmark's Inbound Stream
 * delivery target. Unlike the WhatsApp webhook, there is no GET
 * verification handshake (Postmark doesn't have Meta's one-time
 * hub.challenge convention) and no HMAC signature header — Postmark's
 * documented practice is a shared secret embedded directly in the
 * webhook URL, checked here as a query param before anything in the
 * body is trusted. Rejects with 401 on a missing/invalid token, the
 * same fail-loud posture app/api/webhooks/whatsapp/route.ts already
 * takes on an invalid signature — a genuine misconfiguration should
 * surface as repeated failures, not disappear silently.
 *
 * Responds quickly, no slow inline work — same reasoning as the
 * WhatsApp webhook: an inbound-mail vendor retries on non-200.
 */
async function handleInboundEmail(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!isAuthorized(token)) {
    logger.warn("email.webhook_rejected");
    return NextResponse.json({ received: false }, { status: 401 });
  }

  const rawBody = await request.text();
  const messages = emailService.parseInboundEmails(rawBody, token) ?? [];

  for (const message of messages) {
    logger.info("email.message_received", {
      providerMessageId: message.providerMessageId,
      from: message.fromEmail,
    });
    await conversationService.recordInboundEmailMessage(message);
  }

  return NextResponse.json({ received: true, messageCount: messages.length }, { status: 200 });
}

export const POST = withApiRoute("email.webhook.receive", handleInboundEmail, {
  rateLimit: { limit: 300, windowMs: 60_000 },
});

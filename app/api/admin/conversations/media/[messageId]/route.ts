import { NextResponse } from "next/server";
import { withApiRoute, NotFoundApiError, UpstreamServiceApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getMessageRepository } from "@/lib/db";
import { whatsappService } from "@/lib/services/whatsapp";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "conversations.mediaProxy" });

/**
 * GET /api/admin/conversations/media/[messageId]
 *
 * Module 2.2 (Rich Messaging) — streams an inbound media message's
 * bytes to the admin browser. Meta's own media URLs are short-lived
 * (minutes) and require the same bearer token as every other Graph API
 * call, so a raw <img src> pointing straight at Meta would never work
 * from the browser — this route re-resolves a fresh URL server-side on
 * every request and proxies the bytes through, so the vendor credential
 * never reaches the client.
 *
 * Deliberately NOT a durable re-host: nothing here saves the bytes
 * anywhere. If the vendor's own retention window has passed (Meta keeps
 * inbound media for a limited time), this simply 404s — building actual
 * managed storage is Module 6.2 (File Storage), explicitly out of scope
 * per the Blueprint's own dependency note on this module. Outbound media
 * sends never hit this route (they're sent by URL, and that URL is
 * already public — see WhatsAppMediaPayload's own doc comment).
 *
 * ⚠️ requiredRole: "admin" — this is not a public asset URL.
 */
async function handleGetMedia(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { messageId } = ctx.params;
  const messageRepository = await getMessageRepository();
  const message = await messageRepository.findById(messageId);

  if (!message || !message.mediaId) {
    throw new NotFoundApiError("Media", messageId);
  }

  const resolved = await whatsappService.resolveInboundMediaUrl(message.mediaId);
  if (!resolved) {
    throw new NotFoundApiError("Media", messageId);
  }

  const upstream = await fetch(resolved.url, { headers: resolved.fetchHeaders });
  if (!upstream.ok || !upstream.body) {
    logger.warn("conversations.media_fetch_failed", { messageId, status: upstream.status });
    throw new UpstreamServiceApiError("Could not fetch this attachment.");
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": message.mediaMimeType ?? resolved.mimeType,
      // Short-lived: re-resolving is cheap and correctness (a since-
      // deleted or expired attachment) matters more than shaving one
      // fetch off reopening the same thread within a few minutes.
      "Cache-Control": "private, max-age=300",
    },
  });
}

export const GET = withApiRoute("admin.conversations.media", handleGetMedia, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

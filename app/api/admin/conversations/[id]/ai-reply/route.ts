import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { aiReplyService } from "@/lib/services/conversations/aiReply";
import type { ReplyTone } from "@/lib/services/conversations/aiReply";

const REPLY_TONES: ReplyTone[] = ["professional", "friendly", "concise", "follow_up"];

/**
 * POST /api/admin/conversations/[id]/ai-reply
 *
 * AI CRM (Phase 5), Module 5.2 — generates (or regenerates, same
 * request shape) a suggested reply for this conversation's thread.
 * Never sends anything: the response is always 200 with a
 * `GenerateReplyResult` — `success: true` with a real suggestion,
 * or `success: false` with `reason: "unavailable"` (no AI provider
 * configured) or `"error"` (a real vendor call/response failed).
 * Neither failure mode is surfaced as an HTTP error — same graceful
 * degradation contract 5.1's insights route established, never turning
 * "no AI provider configured" into a broken page.
 *
 * ⚠️ requiredRole: "admin" — same tier as every other Conversations
 * route (see app/api/admin/conversations/[id]/messages/route.ts's own
 * comment on why).
 */
async function handleGenerateReply(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as Record<string, unknown>;
  const tone = body.tone;
  if (typeof tone !== "string" || !REPLY_TONES.includes(tone as ReplyTone)) {
    throw new ValidationApiError([{ field: "tone", message: `tone must be one of: ${REPLY_TONES.join(", ")}.` }]);
  }

  const result = await aiReplyService.generateReply(id, tone as ReplyTone);
  if (!result) throw new NotFoundApiError("Conversation", id);
  return apiSuccess({ result });
}

export const POST = withApiRoute("admin.conversations.aiReply.generate", handleGenerateReply, {
  requiredRole: "admin",
  rateLimit: { limit: 15, windowMs: 60_000 },
});

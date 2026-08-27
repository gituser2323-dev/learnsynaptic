import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { requireAccessibleConversation } from "@/lib/services/conversations";
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
 * Phase 2A — requiredRole counsellor + ownership assert.
 */
async function handleGenerateReply(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  await requireAccessibleConversation(ctx, id);
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
  requiredRole: "counsellor",
  rateLimit: { limit: 15, windowMs: 60_000 },
});

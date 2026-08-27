import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { conversationService, requireAccessibleConversation } from "@/lib/services/conversations";

/**
 * GET /api/admin/conversations/[id]
 *
 * WhatsApp Platform (Phase 2) — the unified thread view: one
 * conversation, every Message in it (chronological), and the internal-
 * note/system-event Activity feed. Marks the conversation read as a
 * side effect of opening it — see conversationService.getThread()'s
 * own comment.
 *
 * Phase 2A — requiredRole counsellor + ownership assert.
 */
async function handleGetThread(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  await requireAccessibleConversation(ctx, id);
  const thread = await conversationService.getThread(id);
  if (!thread) throw new NotFoundApiError("Conversation", id);
  return apiSuccess({ ...thread });
}

export const GET = withApiRoute("admin.conversations.get", handleGetThread, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

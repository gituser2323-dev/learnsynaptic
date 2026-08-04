import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { conversationService } from "@/lib/services/conversations";

/**
 * POST /api/admin/conversations/[id]/assign
 *
 * WhatsApp Platform (Phase 2) — assigns a conversation to a counsellor/
 * manager/admin. Audit-logged (conversation.assigned) and mirrored onto
 * the conversation's own Activity feed as a system event.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleAssign(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { userId?: string };
  if (!body.userId) {
    throw new ValidationApiError([{ field: "userId", message: "userId is required." }]);
  }

  const conversation = await conversationService.assign(id, body.userId, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ conversation });
}

export const POST = withApiRoute("admin.conversations.assign", handleAssign, {
  requiredRole: "admin",
  rateLimit: { limit: 40, windowMs: 60_000 },
});

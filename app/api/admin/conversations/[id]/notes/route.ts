import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { conversationService, requireAccessibleConversation } from "@/lib/services/conversations";

/**
 * POST /api/admin/conversations/[id]/notes
 *
 * WhatsApp Platform (Phase 2) — adds an internal note to a
 * conversation's Activity feed (not visible to the contact, WhatsApp-
 * side — this only ever writes to our own Activity timeline).
 *
 * Phase 2A — requiredRole counsellor + ownership assert.
 */
async function handleAddNote(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  await requireAccessibleConversation(ctx, id);
  const body = (await parseJsonBody(request)) as { body?: string };
  if (!body.body || !body.body.trim()) {
    throw new ValidationApiError([{ field: "body", message: "body is required." }]);
  }

  const activity = await conversationService.addInternalNote(id, body.body, ctx.authContext.userId);
  return apiSuccess({ activity });
}

export const POST = withApiRoute("admin.conversations.notes", handleAddNote, {
  requiredRole: "counsellor",
  rateLimit: { limit: 40, windowMs: 60_000 },
});

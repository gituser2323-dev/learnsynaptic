import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { conversationService } from "@/lib/services/conversations";
import type { ConversationStatus } from "@/lib/services/conversations";

const VALID_STATUSES: ConversationStatus[] = ["open", "closed"];

/**
 * PATCH /api/admin/conversations/[id]/status
 *
 * WhatsApp Platform (Phase 2) — opens/closes a conversation. Mirrored
 * onto the conversation's own Activity feed as a system event.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleSetStatus(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { status?: string };
  if (!body.status || !VALID_STATUSES.includes(body.status as ConversationStatus)) {
    throw new ValidationApiError([{ field: "status", message: "status must be 'open' or 'closed'." }]);
  }

  const conversation = await conversationService.setStatus(id, body.status as ConversationStatus);
  return apiSuccess({ conversation });
}

export const PATCH = withApiRoute("admin.conversations.status", handleSetStatus, {
  requiredRole: "admin",
  rateLimit: { limit: 40, windowMs: 60_000 },
});

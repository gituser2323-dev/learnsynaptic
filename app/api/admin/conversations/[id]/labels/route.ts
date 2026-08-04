import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { conversationService } from "@/lib/services/conversations";

/**
 * PUT /api/admin/conversations/[id]/labels
 *
 * WhatsApp Platform (Phase 2) — replaces a conversation's label set
 * wholesale (not a single add/remove) — the UI always sends the full
 * resulting array. Audit-logged (conversation.labeled).
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleSetLabels(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { labels?: unknown };
  if (!Array.isArray(body.labels) || !body.labels.every((label) => typeof label === "string")) {
    throw new ValidationApiError([{ field: "labels", message: "labels must be an array of strings." }]);
  }

  const conversation = await conversationService.setLabels(id, body.labels, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ conversation });
}

export const PUT = withApiRoute("admin.conversations.labels", handleSetLabels, {
  requiredRole: "admin",
  rateLimit: { limit: 40, windowMs: 60_000 },
});

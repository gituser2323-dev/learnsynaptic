import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { tagService } from "@/lib/services/crm/tags";

/**
 * DELETE /api/admin/crm/tags/[id]
 *
 * Enterprise CRM (Phase 1) — deletes a tag definition. Deliberately does
 * NOT cascade-remove the tag id from every Lead that carries it (a
 * stale tag id in Lead.tags simply stops resolving to a real Tag and is
 * filtered out at render time) — a bulk cascade write across every
 * tagged lead is real, avoidable cost for what is fundamentally a rare,
 * low-stakes cleanup action.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management.
 */
async function handleDeleteTag(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  await tagService.deleteTag(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  return apiSuccess({ deleted: true });
}

export const DELETE = withApiRoute("admin.crm.tags.delete", handleDeleteTag, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

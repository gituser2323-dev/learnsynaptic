import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { customFieldService } from "@/lib/services/crm/customFields";

/**
 * DELETE /api/admin/crm/custom-fields/[id]
 *
 * Enterprise CRM (Phase 1) — removes a custom field definition. Existing
 * values under that key on any Lead are left as-is (harmless orphaned
 * data, same reasoning as tag deletion) rather than a cascading write.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, RBAC (Admin/Manager/Counsellor).
 */
async function handleDeleteDefinition(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  await customFieldService.deleteDefinition(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  return apiSuccess({ deleted: true });
}

export const DELETE = withApiRoute("admin.crm.custom_fields.delete", handleDeleteDefinition, {
  requiredRole: "manager",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

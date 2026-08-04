import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { leadService } from "@/lib/services/leads";

/**
 * POST /api/admin/crm/merge
 *
 * Enterprise CRM (Phase 1) — Lead Merge / conflict resolution. `targetId`
 * survives, `sourceId` is folded in and deleted; `fieldsFromSource`
 * names which fields (if any) should take source's value instead of
 * target's — everything not named keeps target's value, tags always
 * union regardless (see leadService.mergeLeads()).
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, RBAC (Admin/Manager/Counsellor).
 */
async function handleMerge(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = (await parseJsonBody(request)) as { targetId?: string; sourceId?: string; fieldsFromSource?: string[] };
  if (!body.targetId || !body.sourceId) {
    throw new ValidationApiError([{ field: "root", message: "targetId and sourceId are both required." }]);
  }

  const lead = await leadService.mergeLeads(body.targetId, body.sourceId, body.fieldsFromSource ?? [], {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ lead });
}

export const POST = withApiRoute("admin.crm.merge", handleMerge, {
  requiredRole: "manager",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

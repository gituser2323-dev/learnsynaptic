import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { assignmentService } from "@/lib/services/crm/assignment";
import { leadService } from "@/lib/services/leads";

/**
 * POST /api/admin/leads/[id]/assign
 *
 * Enterprise CRM (Phase 1) — Manual Assignment / Reassignment. Records
 * assignment-history via the Activity timeline and audit log
 * (assignmentService.assignManually() — distinguishes "assigned" from
 * "reassigned" based on whether the lead already had an owner).
 *
 * ⚠️ requiredRole: "manager" — Assignment management (RBAC); a
 * counsellor works whatever they're already assigned but never decides
 * who owns a lead.
 */
async function handleAssign(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { counsellorId?: string };
  if (!body.counsellorId) {
    throw new ValidationApiError([{ field: "counsellorId", message: "counsellorId is required." }]);
  }

  await assignmentService.assignManually(id, body.counsellorId, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  const lead = await leadService.getLead(id);
  return apiSuccess({ lead });
}

export const POST = withApiRoute("admin.leads.assign", handleAssign, {
  requiredRole: "manager",
  rateLimit: { limit: 40, windowMs: 60_000 },
});

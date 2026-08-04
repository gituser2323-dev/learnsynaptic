import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { pipelineService } from "@/lib/services/crm/pipelines";

/**
 * DELETE /api/admin/crm/pipelines/[id]
 *
 * Enterprise CRM (Phase 1) — deletes a non-default pipeline. Refuses
 * (see pipelineService.deletePipeline's own comment) if the pipeline is
 * the default one or still has Opportunities on it — both come back as
 * a normal 400, not a 500, since they're expected, recoverable caller
 * mistakes, not server faults.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, RBAC (Admin/Manager/Counsellor).
 */
async function handleDeletePipeline(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const result = await pipelineService.deletePipeline(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!result.success) {
    throw new ValidationApiError([{ field: "root", message: result.reason }]);
  }
  return apiSuccess({ deleted: true });
}

export const DELETE = withApiRoute("admin.crm.pipelines.delete", handleDeletePipeline, {
  requiredRole: "manager",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

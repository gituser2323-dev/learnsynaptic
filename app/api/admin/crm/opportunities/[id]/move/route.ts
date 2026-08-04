import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { pipelineService } from "@/lib/services/crm/pipelines";

/**
 * POST /api/admin/crm/opportunities/[id]/move
 *
 * Enterprise CRM (Phase 1) — the Kanban board's drag-to-advance action.
 * Won/Lost status is derived server-side from the target stage's own
 * isWon/isLost flags (pipelineService.moveStage()) — the client only
 * ever says "which stage," never "mark this won," so the two can't
 * disagree.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, RBAC (Admin/Manager/Counsellor).
 */
async function handleMoveStage(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { stageId?: string; lostReason?: string };
  if (!body.stageId) {
    throw new ValidationApiError([{ field: "stageId", message: "stageId is required." }]);
  }

  const opportunity = await pipelineService.moveStage(id, body.stageId, body.lostReason, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ opportunity });
}

export const POST = withApiRoute("admin.crm.opportunities.move", handleMoveStage, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

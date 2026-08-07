import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError } from "@/lib/api";
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
 * RC-9 — a real bug found via live cross-tenant pentesting, not just
 * code review: `moveStage()` throws a plain `Error` (not one of this
 * app's own `ApiError` subclasses — services never import from
 * `@/lib/api`, a real, consistently-held layering boundary in this
 * codebase, so it can't throw `NotFoundApiError` itself) for its own
 * "opportunity/pipeline/stage not found" cases. Left uncaught, that
 * surfaces as a generic 500 rather than a 404 — confirmed live: an Org
 * A admin naming Org B's real (tenant-scoped-invisible-to-them, hence
 * genuinely not-found) opportunity id got a 500, not a 404. Tenant
 * isolation itself was never actually broken (the repository's own
 * `tenantScopePlugin` correctly returned nothing for the cross-tenant
 * id — confirmed directly), but a 500 is still real, findable-in-logs
 * noise for what is, from this route's own perspective, an entirely
 * ordinary "that id doesn't exist for you" case — indistinguishable
 * from same-tenant caller error. Mapped to a real 404 here rather than
 * changing `moveStage()`'s own signature (would touch every caller).
 */
async function handleMoveStage(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { stageId?: string; lostReason?: string };
  if (!body.stageId) {
    throw new ValidationApiError([{ field: "stageId", message: "stageId is required." }]);
  }

  try {
    const opportunity = await pipelineService.moveStage(id, body.stageId, body.lostReason, {
      actorId: ctx.authContext.userId,
      requestId: ctx.requestId,
    });
    return apiSuccess({ opportunity });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      throw new NotFoundApiError("Opportunity", id);
    }
    throw error;
  }
}

export const POST = withApiRoute("admin.crm.opportunities.move", handleMoveStage, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

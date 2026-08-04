import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { pipelineService } from "@/lib/services/crm/pipelines";
import type { OpportunityListFilters, OpportunityStatus } from "@/lib/services/crm/pipelines";

/**
 * GET /api/admin/crm/opportunities, POST /api/admin/crm/opportunities
 *
 * Enterprise CRM (Phase 1) — the Kanban board's data source. GET is
 * unpaginated (a Kanban board renders every card in the active pipeline
 * at once, the same "load it all, group client-side" shape a board
 * needs) — filtered by pipeline/stage/status/owner if the caller wants
 * a narrower view.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, RBAC (Admin/Manager/Counsellor).
 */
async function handleListOpportunities(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filters: OpportunityListFilters = {
    pipelineId: searchParams.get("pipelineId") || undefined,
    stageId: searchParams.get("stageId") || undefined,
    status: (searchParams.get("status") as OpportunityStatus) || undefined,
    ownerId: searchParams.get("ownerId") || undefined,
  };
  const opportunities = await pipelineService.listOpportunities(filters);
  return apiSuccess({ opportunities });
}

async function handleCreateOpportunity(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = (await parseJsonBody(request)) as Record<string, unknown>;
  const { leadId, pipelineId, stageId, expectedRevenueInr, probability, ownerId } = body;

  if (!leadId || !pipelineId || !stageId) {
    throw new ValidationApiError([{ field: "root", message: "leadId, pipelineId, and stageId are required." }]);
  }

  const opportunity = await pipelineService.createOpportunity(
    {
      leadId: leadId as string,
      pipelineId: pipelineId as string,
      stageId: stageId as string,
      expectedRevenueInr: expectedRevenueInr as number | undefined,
      probability: probability as number | undefined,
      ownerId: ownerId as string | undefined,
    },
    { requestId: ctx.requestId, actorId: ctx.authContext.userId },
  );

  return apiSuccess({ opportunity }, 201);
}

export const GET = withApiRoute("admin.crm.opportunities.list", handleListOpportunities, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.crm.opportunities.create", handleCreateOpportunity, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

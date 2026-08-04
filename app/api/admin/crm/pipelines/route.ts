import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { pipelineService } from "@/lib/services/crm/pipelines";

/**
 * GET /api/admin/crm/pipelines, POST /api/admin/crm/pipelines
 *
 * Enterprise CRM (Phase 1) — lists every pipeline, seeding the default
 * 10-stage pipeline on first call if none exist yet
 * (pipelineService.listPipelines()). POST creates an additional named
 * pipeline (e.g. one per program) — never `isDefault`, so every caller
 * that assumed exactly one pipeline existed keeps working unchanged.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, RBAC (Admin/Manager/Counsellor).
 */
async function handleListPipelines(): Promise<NextResponse> {
  const pipelines = await pipelineService.listPipelines();
  return apiSuccess({ pipelines });
}

async function handleCreatePipeline(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = (await parseJsonBody(request)) as { name?: string; program?: string; stages?: { name?: string; isWon?: boolean; isLost?: boolean }[] };

  const name = body.name?.trim();
  if (!name) {
    throw new ValidationApiError([{ field: "name", message: "Pipeline name is required." }]);
  }
  const stages = (body.stages ?? []).filter((s): s is { name: string; isWon?: boolean; isLost?: boolean } => Boolean(s.name?.trim()));
  if (stages.length === 0) {
    throw new ValidationApiError([{ field: "stages", message: "At least one stage is required." }]);
  }

  const pipeline = await pipelineService.createPipeline(
    { name, program: body.program?.trim() || undefined, stages },
    { actorId: ctx.authContext.userId, requestId: ctx.requestId },
  );
  return apiSuccess({ pipeline }, 201);
}

export const GET = withApiRoute("admin.crm.pipelines.list", handleListPipelines, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.crm.pipelines.create", handleCreatePipeline, {
  requiredRole: "manager",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

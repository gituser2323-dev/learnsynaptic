import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getWorkflowDefinitionRecord, updateWorkflowDefinition, deleteWorkflowDefinition } from "@/lib/services/automation";

/**
 * GET/PATCH/DELETE /api/admin/automation/definitions/[id]
 *
 * Automation Platform (Phase 3), Module 3.1. PATCH is a partial update —
 * name/active/steps are each independently optional, so toggling a
 * definition active/inactive from the Automation page doesn't need to
 * resend its steps. DELETE refuses (see deleteWorkflowDefinition's own
 * comment) while any WorkflowRun is still in flight against this
 * definition — a normal 400, not a 500, since it's an expected,
 * recoverable caller mistake.
 *
 * ⚠️ requiredRole: "admin" — same blast-radius reasoning as the
 * collection route.
 */
async function handleGetDefinition(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const definition = await getWorkflowDefinitionRecord(id);
  if (!definition) throw new NotFoundApiError("WorkflowDefinition", id);
  return apiSuccess({ definition });
}

async function handleUpdateDefinition(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = await parseJsonBody(request);
  const result = await updateWorkflowDefinition(id, body, { requestId: ctx.requestId, actorId: ctx.authContext.userId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ definition: result.definition });
}

async function handleDeleteDefinition(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const result = await deleteWorkflowDefinition(id, { requestId: ctx.requestId, actorId: ctx.authContext.userId });

  if (!result.success) {
    throw new ValidationApiError([{ field: "root", message: result.reason }]);
  }

  return apiSuccess({ deleted: true });
}

export const GET = withApiRoute("admin.automation.definitions.get", handleGetDefinition, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const PATCH = withApiRoute("admin.automation.definitions.update", handleUpdateDefinition, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const DELETE = withApiRoute("admin.automation.definitions.delete", handleDeleteDefinition, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

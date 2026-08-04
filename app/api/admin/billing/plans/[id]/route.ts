import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ForbiddenApiError, NotFoundApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { isValidPlatformAdminRequest } from "@/lib/api/verifyPlatformAdminSecret";
import { planService } from "@/lib/services/billing";

/**
 * GET /api/admin/billing/plans/[id]
 * PATCH /api/admin/billing/plans/[id]
 *
 * Business OS Phase 8, Module 8.3 — see plans/route.ts's own doc
 * comment for the platform-secret gate on writes.
 */
async function handleGetPlan(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const plan = await planService.getPlan(ctx.params.id);
  if (!plan) throw new NotFoundApiError("Plan", ctx.params.id);
  return apiSuccess({ plan });
}

async function handleUpdatePlan(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!isValidPlatformAdminRequest(request)) throw new ForbiddenApiError("Modifying the global Plan catalog requires platform-operator credentials.");

  const body = await parseJsonBody(request);
  const result = await planService.updatePlan(ctx.params.id, body, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!result.success) {
    if (result.error.code === "not_found") throw new NotFoundApiError("Plan", ctx.params.id);
    throw new ValidationApiError(result.error.code === "validation" ? result.error.errors : [{ field: "root", message: result.error.message }]);
  }
  return apiSuccess({ plan: result.data });
}

export const GET = withApiRoute("admin.billing.plans.get", handleGetPlan, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const PATCH = withApiRoute("admin.billing.plans.update", handleUpdatePlan, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ForbiddenApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { isValidPlatformAdminRequest } from "@/lib/api/verifyPlatformAdminSecret";
import { planService } from "@/lib/services/billing";

/**
 * GET /api/admin/billing/plans
 * POST /api/admin/billing/plans
 *
 * Business OS Phase 8, Module 8.3 — the global SaaS Plan catalog. GET
 * is read-only for any tenant admin (needed to render "available plans
 * to upgrade to" in the org's own Billing UI). POST (create a new
 * plan) additionally requires `X-Platform-Admin-Secret` — a real
 * deployment-level secret no tenant admin's own session carries — per
 * the mission's own explicit "do NOT accidentally give tenant Admins
 * permission to modify global SaaS plan definitions." See
 * config/platformAdmin.ts's own doc comment for why this reuses the
 * cron-secret pattern rather than inventing a Super Admin role tier
 * speculatively.
 *
 * ⚠️ requiredRole: "admin" for both; POST additionally platform-secret-gated.
 */
async function handleListPlans(): Promise<NextResponse> {
  const plans = await planService.listPlans();
  return apiSuccess({ plans });
}

async function handleCreatePlan(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!isValidPlatformAdminRequest(request)) throw new ForbiddenApiError("Modifying the global Plan catalog requires platform-operator credentials.");

  const body = await parseJsonBody(request);
  const result = await planService.createPlan(body, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!result.success) {
    if (result.error.code === "validation") throw new ValidationApiError(result.error.errors);
    throw new ValidationApiError([{ field: "id", message: result.error.message }]);
  }
  return apiSuccess({ plan: result.data }, 201);
}

export const GET = withApiRoute("admin.billing.plans.list", handleListPlans, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.billing.plans.create", handleCreatePlan, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

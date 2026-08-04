import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, UnauthorizedApiError, ValidationApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getTenantContext } from "@/lib/tenancy/context";
import { subscriptionService, planService } from "@/lib/services/billing";

/**
 * POST /api/admin/billing/subscription/assign-plan
 *
 * Business OS Phase 8, Module 8.3 — upgrade/downgrade the current
 * organization's own subscription to a different (existing, active)
 * plan. Entitlements/limits update immediately on the next
 * `getEntitlements()` call (they always resolve against the CURRENT
 * plan document, never a frozen snapshot — see types.ts's own `Plan.
 * version` doc comment); no tenant data is ever deleted by this route —
 * a downgrade that puts the organization over a new, lower limit
 * simply blocks further usage of that resource going forward (see
 * usageService.ts's own enforcement), it doesn't touch existing rows.
 *
 * ⚠️ requiredRole: "admin" — a real commercial/billing decision, the
 * same tier every other Settings-level mutation in this app already
 * requires.
 */
async function handleAssignPlan(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const body = (await parseJsonBody(request)) as { planId?: unknown };
  if (typeof body.planId !== "string" || !body.planId.trim()) {
    throw new ValidationApiError([{ field: "planId", message: "planId is required." }]);
  }

  const plan = await planService.getPlan(body.planId);
  if (!plan || plan.status !== "active") throw new NotFoundApiError("Plan", body.planId);

  const subscription = await subscriptionService.assignPlan(organizationId, body.planId, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ subscription });
}

export const POST = withApiRoute("admin.billing.subscription.assign_plan", handleAssignPlan, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

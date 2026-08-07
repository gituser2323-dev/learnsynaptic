import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { subscriptionService } from "@/lib/services/billing";

/**
 * POST /api/admin/platform/organizations/[id]/assign-plan
 *
 * RC-6 — reuses Module 8.3's own subscriptionService.assignPlan wholesale
 * (creates the first real Subscription, or changes plan on an existing
 * one) — never a second implementation of plan-assignment. Real payment
 * collection for a paid plan is a separate, explicit step; this alone
 * never charges anything (see assignPlan's own doc comment).
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleAssignPlan(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { planId?: string };
  if (!body.planId) {
    throw new ValidationApiError([{ field: "planId", message: "planId is required." }]);
  }

  const subscription = await subscriptionService.assignPlan(id, body.planId, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ subscription });
}

export const POST = withApiRoute("platform.organizations.assignPlan", handleAssignPlan, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

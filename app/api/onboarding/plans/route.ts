import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { onboardingService } from "@/lib/services/onboarding";

/**
 * GET /api/onboarding/plans
 *
 * RC-7 — Customer Onboarding & SaaS Activation. The PLAN/TRIAL step's
 * own read side (mission §6) — real, live catalog data, never a
 * hardcoded plan list on the client. See
 * onboardingService.listSelectablePlans()'s own doc comment for the
 * "active, non-internal" filter that keeps LearnSynaptic's own
 * internal-unlimited fallback plan from ever being offered to a real
 * customer.
 */
async function handleListPlans(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const plans = await onboardingService.listSelectablePlans();
  return apiSuccess({ plans });
}

export const GET = withApiRoute("onboarding.plans.list", handleListPlans, {
  rateLimit: { limit: 60, windowMs: 60_000 },
});

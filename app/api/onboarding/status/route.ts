import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { onboardingService } from "@/lib/services/onboarding";

/**
 * GET /api/onboarding/status
 *
 * RC-7 — Customer Onboarding & SaaS Activation. Mission §34's own
 * "resolve onboarding state server-side" requirement: the wizard's own
 * client calls this on load to decide where to render, rather than
 * trusting any client-side/localStorage state. Reachable both before
 * AND after an organization exists (`onboarding.*` — see
 * withApiRoute.ts's own "RC-7" doc comment for why this is one of the
 * two route namespaces exempt from the pre-organization gate).
 *
 * A validly-authenticated request whose user record genuinely can't be
 * found is NOT reported as 401 — a real bug found live via the E2E
 * suite: this route is called from the main dashboard's own
 * SetupChecklist widget on every page load, and apiClient.ts's
 * apiFetch() treats ANY 401 from ANY route as "session is dead,
 * hard-redirect to /admin/login" globally. A 401 here would mean a
 * harmless, nice-to-have onboarding-progress widget failing could take
 * down the ENTIRE dashboard for a user in this edge case — the
 * mission's own "do not trap users" instruction (§34) applies to this
 * failure mode too, not just to forced wizard redirects. Reports the
 * same neutral "done" status apiSuccess would for a fully-activated
 * org instead — every caller (this route's own onboarding page, the
 * login redirect check, SetupChecklist) already treats "done" as "show
 * the normal dashboard, nothing to resolve here," which is exactly the
 * safe, fail-open behavior this edge case needs.
 */
async function handleGetStatus(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const status = await onboardingService.getOnboardingStatus(ctx.authContext.userId);
  if (!status) {
    return apiSuccess({ status: { emailVerified: true, organization: null, resumeStep: "done", steps: {} } });
  }
  return apiSuccess({ status });
}

export const GET = withApiRoute("onboarding.status", handleGetStatus, {
  rateLimit: { limit: 60, windowMs: 60_000 },
});

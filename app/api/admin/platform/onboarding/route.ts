import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { platformOnboardingService } from "@/lib/services/platformAdmin";

/**
 * GET /api/admin/platform/onboarding
 *
 * RC-7 — Customer Onboarding & SaaS Activation. Mission §32/§44: the
 * Platform Super Admin's own aggregate onboarding funnel plus a
 * per-organization onboarding status list — see
 * platformOnboardingService's own doc comment for why every number
 * here is a real query, never tenant-private CRM data.
 *
 * ⚠️ requiredPlatformRole: "super_admin" — also enforces MFA (see
 * withApiRoute.ts).
 */
async function handleGetOnboardingFunnel(request: Request, _ctx: ApiRouteContext): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;

  const [funnel, organizations] = await Promise.all([
    platformOnboardingService.getFunnelSnapshot(),
    platformOnboardingService.listOrganizationOnboardingStatus(page, limit),
  ]);

  return apiSuccess({ funnel, organizations });
}

export const GET = withApiRoute("platform.onboarding", handleGetOnboardingFunnel, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

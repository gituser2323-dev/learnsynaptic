import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { platformOrganizationService } from "@/lib/services/organizations";
import { subscriptionService, planService, entitlementService } from "@/lib/services/billing";
import { getUserRepository } from "@/lib/db";

/**
 * GET /api/admin/platform/organizations/[id]
 *
 * RC-6 — a real, cross-service org detail view: organization record,
 * subscription, plan, active user count, and the fully-resolved
 * entitlements (plan capabilities/limits with any operator overrides
 * already merged — see entitlementService.getEntitlements). Never
 * exposes tenant secrets — no encrypted credentials, no API keys, no
 * raw integration tokens (see RC-6 audit's own "secret management"
 * section for the "Configured/Missing/Healthy" projection this
 * intentionally stops short of).
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleGetOrganization(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const organization = await platformOrganizationService.getOrganization(id);
  if (!organization) throw new NotFoundApiError("Organization", id);

  const [subscription, userRepository] = await Promise.all([
    subscriptionService.getForOrganization(id),
    getUserRepository(),
  ]);
  const [plan, activeUsers, entitlements] = await Promise.all([
    planService.getPlan(subscription.planId),
    userRepository.listActive(),
    entitlementService.getEntitlements(id).catch(() => null),
  ]);

  const userCount = activeUsers.filter((u) => u.organizationId === id).length;

  return apiSuccess({
    organization,
    subscription,
    plan,
    userCount,
    entitlements: entitlements
      ? { capabilities: Array.from(entitlements.capabilities), limits: entitlements.limits }
      : null,
  });
}

export const GET = withApiRoute("platform.organizations.get", handleGetOrganization, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

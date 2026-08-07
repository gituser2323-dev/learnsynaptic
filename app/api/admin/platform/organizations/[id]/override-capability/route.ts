import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { subscriptionService, PLAN_CAPABILITIES } from "@/lib/services/billing";
import type { PlanCapability } from "@/lib/services/billing";

/**
 * POST /api/admin/platform/organizations/[id]/override-capability
 *
 * RC-6 — "Enable feature temporarily" / revoke, per-tenant, reversible,
 * audited — never a Plan document edit (see subscriptionService.overrideCapability's
 * own doc comment). `granted: null` clears the override (reverts to
 * whatever the assigned plan itself says).
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleOverrideCapability(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { capability?: string; granted?: boolean | null };

  if (!body.capability || !PLAN_CAPABILITIES.includes(body.capability as PlanCapability)) {
    throw new ValidationApiError([{ field: "capability", message: `capability must be one of: ${PLAN_CAPABILITIES.join(", ")}.` }]);
  }
  if (body.granted !== true && body.granted !== false && body.granted !== null) {
    throw new ValidationApiError([{ field: "granted", message: "granted must be true, false, or null (to clear the override)." }]);
  }

  const subscription = await subscriptionService.overrideCapability(id, body.capability as PlanCapability, body.granted, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ subscription });
}

export const POST = withApiRoute("platform.organizations.overrideCapability", handleOverrideCapability, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

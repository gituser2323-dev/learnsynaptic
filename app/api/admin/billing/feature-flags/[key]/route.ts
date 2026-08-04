import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { isValidPlatformAdminRequest } from "@/lib/api/verifyPlatformAdminSecret";
import { featureFlagService } from "@/lib/services/billing";

/**
 * PATCH /api/admin/billing/feature-flags/[key]
 *
 * Business OS Phase 8, Module 8.3 — see feature-flags/route.ts's own
 * doc comment for the platform-secret gate.
 */
async function handleUpdateFlag(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!isValidPlatformAdminRequest(request)) throw new ForbiddenApiError("Managing feature flags requires platform-operator credentials.");

  const body = (await parseJsonBody(request)) as { description?: string; enabled?: boolean; organizationOverrides?: Record<string, boolean> };
  const flag = await featureFlagService.updateFlag(ctx.params.key, body, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  return apiSuccess({ flag });
}

export const PATCH = withApiRoute("admin.billing.feature_flags.update", handleUpdateFlag, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

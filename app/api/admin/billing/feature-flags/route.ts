import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ForbiddenApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { isValidPlatformAdminRequest } from "@/lib/api/verifyPlatformAdminSecret";
import { featureFlagService } from "@/lib/services/billing";

/**
 * GET /api/admin/billing/feature-flags
 * POST /api/admin/billing/feature-flags
 *
 * Business OS Phase 8, Module 8.3 — platform feature flags (see
 * types.ts's own doc comment on why these are separate from plan
 * entitlements). Same platform-secret write gate as the Plan catalog
 * — a feature flag is deployment-wide configuration, not any one
 * tenant's own setting.
 *
 * ⚠️ requiredRole: "admin" for both; POST additionally platform-secret-gated.
 */
async function handleListFlags(): Promise<NextResponse> {
  const flags = await featureFlagService.listFlags();
  return apiSuccess({ flags });
}

async function handleCreateFlag(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!isValidPlatformAdminRequest(request)) throw new ForbiddenApiError("Managing feature flags requires platform-operator credentials.");

  const body = (await parseJsonBody(request)) as { key?: unknown; description?: unknown; enabled?: unknown };
  if (typeof body.key !== "string" || !body.key.trim()) throw new ValidationApiError([{ field: "key", message: "key is required." }]);
  if (typeof body.description !== "string" || !body.description.trim()) throw new ValidationApiError([{ field: "description", message: "description is required." }]);

  const flag = await featureFlagService.createFlag(
    { key: body.key.trim(), description: body.description.trim(), enabled: typeof body.enabled === "boolean" ? body.enabled : false },
    { actorId: ctx.authContext.userId, requestId: ctx.requestId },
  );
  return apiSuccess({ flag }, 201);
}

export const GET = withApiRoute("admin.billing.feature_flags.list", handleListFlags, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.billing.feature_flags.create", handleCreateFlag, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

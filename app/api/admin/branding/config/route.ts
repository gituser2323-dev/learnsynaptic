import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, UnauthorizedApiError, ValidationApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getTenantContext } from "@/lib/tenancy/context";
import { brandingService } from "@/lib/services/branding";

/**
 * GET /api/admin/branding/config
 * PUT /api/admin/branding/config
 * DELETE /api/admin/branding/config
 *
 * Business OS Phase 8, Module 8.4 — the RAW stored configuration
 * (unlike `GET /api/admin/branding`'s resolved, entitlement-collapsed
 * shape) for the admin Settings UI's own edit form to prefill and
 * save. `white_label` capability is enforced inside
 * `brandingService.updateConfiguration()` itself (throws/returns
 * `not_entitled`), not duplicated here.
 *
 * ⚠️ requiredRole: "admin" for all three — managing organization-wide
 * branding is a tenant-Admin-only capability (never Manager/Counsellor,
 * per the mission's own explicit RBAC section), the same tier every
 * other Settings-level mutation in this app already requires.
 */
async function handleGetConfig(): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();
  const config = await brandingService.getRawConfiguration(organizationId);
  return apiSuccess({ config });
}

async function handleUpdateConfig(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const body = await parseJsonBody(request);
  const result = await brandingService.updateConfiguration(organizationId, body, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!result.success) {
    if (result.error.code === "not_entitled") throw new ForbiddenApiError(result.error.message);
    throw new ValidationApiError(result.error.code === "validation" ? result.error.errors : [{ field: "root", message: result.error.message }]);
  }
  return apiSuccess({ config: result.data });
}

async function handleResetConfig(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();
  await brandingService.resetConfiguration(organizationId, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  return apiSuccess({ reset: true });
}

export const GET = withApiRoute("admin.branding.config.get", handleGetConfig, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const PUT = withApiRoute("admin.branding.config.update", handleUpdateConfig, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const DELETE = withApiRoute("admin.branding.config.reset", handleResetConfig, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

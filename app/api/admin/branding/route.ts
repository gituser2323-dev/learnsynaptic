import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import { getTenantContext } from "@/lib/tenancy/context";
import { brandingService } from "@/lib/services/branding";

/**
 * GET /api/admin/branding
 *
 * Business OS Phase 8, Module 8.4 — the resolved, render-ready
 * branding for the CURRENT organization (never any other — see
 * `themeResolver.ts`'s own doc comment on why this can't cross tenant
 * boundaries even in principle). Deliberately available to EVERY
 * authenticated role, including counsellor: branding is a viewing
 * experience every staff member's own admin shell needs to render
 * correctly, not a managed permission — only WRITING branding
 * (`PUT/DELETE .../config`) is admin-gated.
 *
 * ⚠️ requiredRole: "counsellor" (the floor tier — any authenticated
 * staff member).
 */
async function handleGetBranding(): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();
  const branding = await brandingService.getResolvedBranding(organizationId);
  return apiSuccess({ branding });
}

export const GET = withApiRoute("admin.branding.get", handleGetBranding, {
  requiredRole: "counsellor",
  rateLimit: { limit: 120, windowMs: 60_000 },
});

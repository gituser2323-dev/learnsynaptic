import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getTenantContext } from "@/lib/tenancy/context";
import { embeddedSignupService } from "@/lib/services/whatsapp";

/**
 * GET /api/admin/integrations/whatsapp/embedded-signup/status
 *
 * Business OS Phase 8, Module 8.5 — the rich connection-state read the
 * admin UI polls after completing signup, and on every Settings page
 * load thereafter. Always resolves against the CALLER'S OWN tenant
 * context — there is no `organizationId` parameter on this route at
 * all, so Organization A can never even construct a request that reads
 * Organization B's connection state.
 */
async function handleGetStatus(_request: Request, _ctx: ApiRouteContext): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const summary = await embeddedSignupService.getConnectionSummary(organizationId);
  return apiSuccess({ connection: summary });
}

export const GET = withApiRoute("admin.integrations.whatsapp.embeddedSignup.status", handleGetStatus, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

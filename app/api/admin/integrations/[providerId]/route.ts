import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";

/**
 * GET /api/admin/integrations/[providerId]
 *
 * Integrations Hub (Phase 6), Module 6.1 — one provider's merged
 * summary. 404 for a providerId not in the static catalog (see
 * providerCatalog.ts) — an unknown provider is a real client error,
 * not a legitimate "disconnected" state.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleGetIntegration(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  const integration = await integrationService.getIntegration(providerId);
  if (!integration) throw new NotFoundApiError("Integration", providerId);
  return apiSuccess({ integration });
}

export const GET = withApiRoute("admin.integrations.get", handleGetIntegration, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

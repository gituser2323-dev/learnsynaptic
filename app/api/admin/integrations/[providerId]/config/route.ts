import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";
import { throwForIntegrationError } from "../../_lib/errorMapping";

/**
 * PUT /api/admin/integrations/[providerId]/config
 *
 * Integrations Hub (Phase 6), Module 6.1 — updates a connected
 * provider's non-secret configuration. Validated server-side to reject
 * any key that looks credential-shaped (see validation.ts) — a real
 * secret never has a legitimate path into this field.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleUpdateConfig(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  const body = (await parseJsonBody(request)) as { config?: unknown };

  const result = await integrationService.updateConfig(providerId, body.config, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  if (!result.success) throwForIntegrationError(result.error, providerId);
  return apiSuccess({ integration: result.data });
}

export const PUT = withApiRoute("admin.integrations.updateConfig", handleUpdateConfig, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

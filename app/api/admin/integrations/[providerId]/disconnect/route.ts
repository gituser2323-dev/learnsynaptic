import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";
import { throwForIntegrationError } from "../../_lib/errorMapping";

/**
 * POST /api/admin/integrations/[providerId]/disconnect
 *
 * Integrations Hub (Phase 6), Module 6.1 — flips a connection to
 * disconnected/disabled; the row and its log/audit history persist
 * (see IntegrationConnectionRepository's own doc comment on why this
 * is never a hard delete) — "Reconnect" is just Connect called again
 * later. Rejected for builtIn providers, same as Connect.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleDisconnect(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  const result = await integrationService.disconnect(providerId, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!result.success) throwForIntegrationError(result.error, providerId);
  return apiSuccess({ integration: result.data });
}

export const POST = withApiRoute("admin.integrations.disconnect", handleDisconnect, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

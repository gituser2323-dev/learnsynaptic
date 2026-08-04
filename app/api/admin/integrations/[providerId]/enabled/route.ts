import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";
import { throwForIntegrationError } from "../../_lib/errorMapping";

/**
 * PATCH /api/admin/integrations/[providerId]/enabled
 *
 * Integrations Hub (Phase 6), Module 6.1 — Enable/Disable, distinct
 * from Connect/Disconnect: a connected-but-disabled integration keeps
 * its config/credentialRef, it's just not active. Requires an already-
 * connected provider (a disconnected one has nothing to enable).
 *
 * Body: `{ enabled: boolean }`.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleSetEnabled(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  const body = (await parseJsonBody(request)) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") {
    throw new ValidationApiError([{ field: "enabled", message: "enabled must be a boolean." }]);
  }

  const result = await integrationService.setEnabled(providerId, body.enabled, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  if (!result.success) throwForIntegrationError(result.error, providerId);
  return apiSuccess({ integration: result.data });
}

export const PATCH = withApiRoute("admin.integrations.setEnabled", handleSetEnabled, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

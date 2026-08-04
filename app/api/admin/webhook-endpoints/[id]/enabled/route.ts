import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { webhookService, WebhookEndpointNotFoundError } from "@/lib/services/webhooks";

/**
 * PATCH /api/admin/webhook-endpoints/[id]/enabled
 *
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 * manual "Disable Broken Endpoints" / re-enable action, mirroring
 * Module 6.1's own `/api/admin/integrations/[providerId]/enabled`
 * route exactly. Re-enabling clears `consecutiveFailures` (see
 * webhookService.setEndpointStatus's own doc comment).
 */
async function handleSetEnabled(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof (body as Record<string, unknown>).enabled !== "boolean") {
    throw new ValidationApiError([{ field: "enabled", message: "enabled (boolean) is required." }]);
  }

  const enabled = (body as Record<string, unknown>).enabled as boolean;
  try {
    const endpoint = await webhookService.setEndpointStatus(id, enabled ? "active" : "disabled", {
      actorId: ctx.authContext.userId,
      requestId: ctx.requestId,
    });
    return apiSuccess({ endpoint });
  } catch (error) {
    if (error instanceof WebhookEndpointNotFoundError) throw new NotFoundApiError("WebhookEndpoint", id);
    throw error;
  }
}

export const PATCH = withApiRoute("admin.webhookEndpoints.setEnabled", handleSetEnabled, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

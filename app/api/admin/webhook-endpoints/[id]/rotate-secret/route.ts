import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { webhookService, WebhookEndpointNotFoundError } from "@/lib/services/webhooks";

/**
 * POST /api/admin/webhook-endpoints/[id]/rotate-secret
 *
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * "Secret Management" / rotation. Returns the new secret ONCE, in
 * plaintext — see webhookService.rotateSecret's own doc comment for
 * why no dual-secret grace period is needed here.
 */
async function handleRotateSecret(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  try {
    const result = await webhookService.rotateSecret(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
    return apiSuccess({ endpoint: result.endpoint, secret: result.secret });
  } catch (error) {
    if (error instanceof WebhookEndpointNotFoundError) throw new NotFoundApiError("WebhookEndpoint", id);
    throw error;
  }
}

export const POST = withApiRoute("admin.webhookEndpoints.rotateSecret", handleRotateSecret, {
  requiredRole: "admin",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

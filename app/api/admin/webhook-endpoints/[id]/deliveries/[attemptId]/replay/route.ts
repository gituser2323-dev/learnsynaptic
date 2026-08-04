import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { webhookService, WebhookEndpointNotFoundError } from "@/lib/services/webhooks";

/**
 * POST /api/admin/webhook-endpoints/[id]/deliveries/[attemptId]/replay
 *
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * "Replay Failed Events": re-delivers a specific past attempt's own
 * payload snapshot, as a fresh attempt — see
 * webhookService.replayDelivery's own doc comment on why this replays
 * the DELIVERY, not the original domain event.
 */
async function handleReplay(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { attemptId } = ctx.params;
  try {
    const attempt = await webhookService.replayDelivery(attemptId, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
    return apiSuccess({ attempt });
  } catch (error) {
    if (error instanceof WebhookEndpointNotFoundError) throw new NotFoundApiError("WebhookEndpoint", ctx.params.id);
    throw error;
  }
}

export const POST = withApiRoute("admin.webhookEndpoints.deliveries.replay", handleReplay, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

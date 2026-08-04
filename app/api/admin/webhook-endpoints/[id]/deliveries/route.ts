import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, parsePaginationParams } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { webhookService } from "@/lib/services/webhooks";
import type { WebhookDeliveryOutcome } from "@/lib/services/webhooks";

const DELIVERY_OUTCOMES: WebhookDeliveryOutcome[] = ["pending", "delivered", "failed", "dead_letter"];

/**
 * GET /api/admin/webhook-endpoints/[id]/deliveries
 *
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * "Delivery History"/"Delivery Status" for one endpoint.
 */
async function handleListDeliveries(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const endpoint = await webhookService.getEndpoint(id);
  if (!endpoint) throw new NotFoundApiError("WebhookEndpoint", id);

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const outcome = searchParams.get("outcome");
  const result = await webhookService.listDeliveries(
    { endpointId: id, outcome: outcome && DELIVERY_OUTCOMES.includes(outcome as WebhookDeliveryOutcome) ? (outcome as WebhookDeliveryOutcome) : undefined },
    page,
    limit,
  );
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.webhookEndpoints.deliveries.list", handleListDeliveries, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { webhookService, WebhookEndpointNotFoundError } from "@/lib/services/webhooks";

/**
 * POST /api/admin/webhook-endpoints/[id]/test
 *
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * "Test Endpoint": a real, immediate, signed delivery — see
 * webhookService.testEndpoint's own doc comment. Always returns 200
 * with the real outcome in the body (success: true/false) rather than
 * propagating the third party's own failure as this route's status
 * code — the *request to test* succeeded either way.
 */
async function handleTestEndpoint(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  try {
    const result = await webhookService.testEndpoint(id);
    return apiSuccess({ result });
  } catch (error) {
    if (error instanceof WebhookEndpointNotFoundError) throw new NotFoundApiError("WebhookEndpoint", id);
    throw error;
  }
}

export const POST = withApiRoute("admin.webhookEndpoints.test", handleTestEndpoint, {
  requiredRole: "admin",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

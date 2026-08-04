import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError, parsePaginationParams } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { webhookService } from "@/lib/services/webhooks";
import type { WebhookEndpointStatus } from "@/lib/services/webhooks";

const ENDPOINT_STATUSES: WebhookEndpointStatus[] = ["active", "disabled", "auto_disabled"];

/**
 * POST /api/admin/webhook-endpoints, GET /api/admin/webhook-endpoints
 *
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 * "Webhook Registry"/"Endpoint Management" requirement. The response
 * to a successful POST includes the endpoint's real signing secret
 * ONCE, in plaintext — never retrievable again after this response,
 * the same "shown once" UX webhookService.registerEndpoint()'s own
 * doc comment establishes.
 *
 * ⚠️ requiredRole: "admin" — a registered endpoint is a real, standing
 * outbound integration this app will call on every matching event
 * going forward, the same tier Module 6.1's own connect/disconnect
 * already uses for establishing a provider connection.
 */
async function handleRegisterEndpoint(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body) throw new ValidationApiError([{ field: "root", message: "Request body must be valid JSON." }]);

  const result = await webhookService.registerEndpoint(body, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!result.success) throw new ValidationApiError(result.errors);
  return apiSuccess({ endpoint: result.endpoint, secret: result.secret }, 201);
}

async function handleListEndpoints(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const status = searchParams.get("status");
  const result = await webhookService.listEndpoints(
    { status: status && ENDPOINT_STATUSES.includes(status as WebhookEndpointStatus) ? (status as WebhookEndpointStatus) : undefined },
    page,
    limit,
  );
  return apiSuccess({ ...result });
}

export const POST = withApiRoute("admin.webhookEndpoints.register", handleRegisterEndpoint, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const GET = withApiRoute("admin.webhookEndpoints.list", handleListEndpoints, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

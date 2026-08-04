import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { webhookService, WebhookEndpointNotFoundError } from "@/lib/services/webhooks";

/**
 * GET/PATCH/DELETE /api/admin/webhook-endpoints/[id]
 *
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — DELETE
 * disables rather than hard-deletes (see webhookService.deleteEndpoint's
 * own doc comment) so its Delivery History stays inspectable.
 *
 * ⚠️ requiredRole: "admin" — same tier as the register/list route.
 */
async function handleGetEndpoint(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const endpoint = await webhookService.getEndpoint(id);
  if (!endpoint) throw new NotFoundApiError("WebhookEndpoint", id);
  return apiSuccess({ endpoint });
}

async function handleUpdateEndpoint(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw new ValidationApiError([{ field: "root", message: "Request body must be valid JSON." }]);

  const input: { name?: string; url?: string; subscribedEventTypes?: string[] } = {};
  if (typeof (body as Record<string, unknown>).name === "string") input.name = (body as Record<string, unknown>).name as string;
  if (typeof (body as Record<string, unknown>).url === "string") input.url = (body as Record<string, unknown>).url as string;
  if (Array.isArray((body as Record<string, unknown>).subscribedEventTypes)) {
    input.subscribedEventTypes = ((body as Record<string, unknown>).subscribedEventTypes as unknown[]).filter(
      (v): v is string => typeof v === "string",
    );
  }

  try {
    const endpoint = await webhookService.updateEndpoint(id, input, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
    return apiSuccess({ endpoint });
  } catch (error) {
    if (error instanceof WebhookEndpointNotFoundError) throw new NotFoundApiError("WebhookEndpoint", id);
    throw error;
  }
}

async function handleDeleteEndpoint(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  try {
    await webhookService.deleteEndpoint(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof WebhookEndpointNotFoundError) throw new NotFoundApiError("WebhookEndpoint", id);
    throw error;
  }
}

export const GET = withApiRoute("admin.webhookEndpoints.get", handleGetEndpoint, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const PATCH = withApiRoute("admin.webhookEndpoints.update", handleUpdateEndpoint, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const DELETE = withApiRoute("admin.webhookEndpoints.delete", handleDeleteEndpoint, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

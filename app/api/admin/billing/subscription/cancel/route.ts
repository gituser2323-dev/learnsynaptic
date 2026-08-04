import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getTenantContext } from "@/lib/tenancy/context";
import { subscriptionService } from "@/lib/services/billing";

/**
 * POST /api/admin/billing/subscription/cancel
 *
 * Business OS Phase 8, Module 8.3 — cancels the current organization's
 * subscription: at period end by default (full access continues
 * through `currentPeriodEnd`), or immediately with `{"immediate":true}`.
 * Never deletes tenant data either way — cancellation only changes
 * future entitlement resolution (see subscriptionService.cancel()'s
 * own doc comment).
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleCancel(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const text = await request.text();
  const body = text.trim() ? (JSON.parse(text) as { immediate?: boolean }) : {};

  const subscription = await subscriptionService.cancel(organizationId, { immediate: !!body.immediate }, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  return apiSuccess({ subscription });
}

export const POST = withApiRoute("admin.billing.subscription.cancel", handleCancel, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

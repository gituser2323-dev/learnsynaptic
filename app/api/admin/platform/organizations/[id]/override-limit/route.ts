import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { subscriptionService, USAGE_METRICS } from "@/lib/services/billing";
import type { UsageMetric } from "@/lib/services/billing";

/**
 * POST /api/admin/platform/organizations/[id]/override-limit
 *
 * RC-6 — "Increase limit," per-tenant, reversible, audited — never a
 * Plan document edit. `value: null` sets "unlimited for this org
 * only"; `clear: true` removes the override entirely (reverts to the
 * plan's own limit) — these are deliberately distinct (see
 * subscriptionService.overrideLimit's own doc comment).
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleOverrideLimit(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { metric?: string; value?: number | null; clear?: boolean };

  if (!body.metric || !USAGE_METRICS.includes(body.metric as UsageMetric)) {
    throw new ValidationApiError([{ field: "metric", message: `metric must be one of: ${USAGE_METRICS.join(", ")}.` }]);
  }
  if (!body.clear && body.value !== null && (typeof body.value !== "number" || body.value < 0)) {
    throw new ValidationApiError([{ field: "value", message: "value must be a non-negative number, or null for unlimited." }]);
  }

  const subscription = await subscriptionService.overrideLimit(
    id,
    body.metric as UsageMetric,
    body.value ?? null,
    { clear: !!body.clear },
    { actorId: ctx.authContext.userId, requestId: ctx.requestId },
  );
  return apiSuccess({ subscription });
}

export const POST = withApiRoute("platform.organizations.overrideLimit", handleOverrideLimit, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

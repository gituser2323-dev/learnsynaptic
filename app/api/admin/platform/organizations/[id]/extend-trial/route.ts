import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { subscriptionService } from "@/lib/services/billing";

/**
 * POST /api/admin/platform/organizations/[id]/extend-trial
 *
 * RC-6 — throws (surfaced as a 400 via ValidationApiError-equivalent
 * handling in subscriptionService.extendTrial's own thrown Error →
 * handleError.ts's generic-Error branch) if the organization isn't
 * currently on a trial — this is a targeted extension, not a "start a
 * trial" action.
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleExtendTrial(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { days?: number };
  if (!body.days || body.days <= 0 || !Number.isFinite(body.days)) {
    throw new ValidationApiError([{ field: "days", message: "days must be a positive number." }]);
  }

  const subscription = await subscriptionService.extendTrial(id, body.days, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ subscription });
}

export const POST = withApiRoute("platform.organizations.extendTrial", handleExtendTrial, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

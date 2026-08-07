import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ForbiddenApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { platformJobOpsService } from "@/lib/services/platformAdmin";

/**
 * POST /api/admin/platform/jobs/[id]/retry
 *
 * RC-6 — safe cross-tenant retry only: refuses (403, with the real
 * reason) for job types RC-5 classified MUST NOT REPLAY AUTOMATICALLY
 * (a real external side effect with no idempotency guard — see
 * platformJobOpsService's own doc comment). Never blindly replays a
 * financial or customer-facing side effect.
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleRetry(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const result = await platformJobOpsService.retryJob(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (result.refusedReason) throw new ForbiddenApiError(result.refusedReason);
  if (!result.success) throw new NotFoundApiError("ScheduledJob", id);
  return apiSuccess({ job: result.job });
}

export const POST = withApiRoute("platform.jobs.retry", handleRetry, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { retryScheduledJob } from "@/lib/services/scheduler";
import { getTenantContext } from "@/lib/tenancy/context";

/**
 * POST /api/admin/jobs/[id]/retry
 *
 * RC-3 — Reliability, Queues & Observability. "Safe retry/replay" for a
 * dead-lettered (or plain failed) job — see retryScheduledJob's own doc
 * comment for exactly what resets. Requires a real organizationId from
 * the caller's own tenant context before doing anything: retryScheduledJob
 * treats a job belonging to a different organization identically to
 * "not found," so this route fails closed (401) rather than silently
 * passing `undefined` through, which would disable that ownership check
 * entirely — see that function's own doc comment.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleRetryJob(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const { id } = ctx.params;
  const result = await retryScheduledJob(id, organizationId);
  if (!result.success) throw new NotFoundApiError("ScheduledJob", id);

  return apiSuccess({ job: result.job });
}

export const POST = withApiRoute("admin.jobs.retry", handleRetryJob, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

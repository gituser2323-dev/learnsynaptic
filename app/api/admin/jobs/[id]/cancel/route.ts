import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { cancelScheduledJob } from "@/lib/services/scheduler";
import { getTenantContext } from "@/lib/tenancy/context";

/**
 * POST /api/admin/jobs/[id]/cancel
 *
 * RC-3 — Reliability, Queues & Observability. Cancels a still-"pending"
 * job before it ever runs — see cancelScheduledJob's own doc comment
 * for why only that status qualifies. Same fail-closed organizationId
 * requirement as the retry route's own doc comment describes.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleCancelJob(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const { id } = ctx.params;
  const result = await cancelScheduledJob(id, organizationId);
  if (!result.success) throw new NotFoundApiError("ScheduledJob", id);

  return apiSuccess({ job: result.job });
}

export const POST = withApiRoute("admin.jobs.cancel", handleCancelJob, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

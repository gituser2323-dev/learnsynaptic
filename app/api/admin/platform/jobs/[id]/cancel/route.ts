import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { platformJobOpsService } from "@/lib/services/platformAdmin";

/**
 * POST /api/admin/platform/jobs/[id]/cancel
 *
 * RC-6 — always safe (a still-pending job simply never runs); no
 * replay-safety gate needed, unlike retry.
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleCancel(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const result = await platformJobOpsService.cancelJob(id);
  if (!result.success) throw new NotFoundApiError("ScheduledJob", id);
  return apiSuccess({ job: result.job });
}

export const POST = withApiRoute("platform.jobs.cancel", handleCancel, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

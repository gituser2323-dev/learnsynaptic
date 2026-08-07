import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { platformJobOpsService } from "@/lib/services/platformAdmin";
import type { ScheduledJobStatus } from "@/lib/services/scheduler";

const VALID_STATUSES = new Set<ScheduledJobStatus>(["pending", "processing", "completed", "failed", "dead_lettered", "cancelled"]);

/**
 * GET /api/admin/platform/jobs
 *
 * RC-6 — cross-tenant queue/DLQ visibility, reusing RC-3's scheduler
 * wholesale. Distinct from the tenant-scoped `GET /api/admin/jobs`
 * (which any tenant admin already reaches, scoped to their own org) —
 * this sees every organization's jobs, gated on platform role instead.
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleListJobs(request: Request, _ctx: ApiRouteContext): Promise<NextResponse> {
  const url = new URL(request.url);
  const { page, limit } = parsePaginationParams(url.searchParams);
  const statusParam = url.searchParams.get("status");
  const status = statusParam && VALID_STATUSES.has(statusParam as ScheduledJobStatus) ? (statusParam as ScheduledJobStatus) : undefined;
  const jobType = url.searchParams.get("jobType") ?? undefined;
  const organizationId = url.searchParams.get("organizationId") ?? undefined;

  const result = await platformJobOpsService.listJobs({ status, jobType, organizationId }, page, limit);
  return apiSuccess({ result });
}

export const GET = withApiRoute("platform.jobs.list", handleListJobs, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

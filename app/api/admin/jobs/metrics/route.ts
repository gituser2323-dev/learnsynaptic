import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import { getQueueMetrics } from "@/lib/services/scheduler";
import { getTenantContext } from "@/lib/tenancy/context";

/**
 * GET /api/admin/jobs/metrics
 *
 * RC-3 — Reliability, Queues & Observability. The admin Reliability
 * panel's metrics fetch: queue depth (`countsByStatus.pending`), DLQ
 * size (`countsByStatus.dead_lettered`), oldest-pending-job age (a
 * poller-falling-behind signal), and a bounded per-jobType failure
 * breakdown (the mission's own "per-domain failure counts," capped at
 * 20 job types to avoid an unbounded/high-cardinality response — see
 * QueueMetrics' own doc comment in lib/services/scheduler/types.ts).
 *
 * Scoped to the caller's own organizationId, same as GET
 * /api/admin/jobs — tenant isolation applies to metrics visibility
 * exactly as it does to the underlying job records.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleGetJobMetrics(): Promise<NextResponse> {
  // Same fail-closed guard as GET /api/admin/jobs — a missing
  // organizationId must never fall through to getQueueMetrics()'s own
  // "no filter" behavior (platform-wide metrics across every tenant).
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const metrics = await getQueueMetrics(organizationId);
  return apiSuccess({ metrics });
}

export const GET = withApiRoute("admin.jobs.metrics", handleGetJobMetrics, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

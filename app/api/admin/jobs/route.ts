import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams, UnauthorizedApiError } from "@/lib/api";
import { listScheduledJobs } from "@/lib/services/scheduler";
import { getTenantContext } from "@/lib/tenancy/context";
import type { ScheduledJob, ScheduledJobListFilters, ScheduledJobStatus } from "@/lib/services/scheduler";

const VALID_STATUSES: ScheduledJobStatus[] = ["pending", "processing", "completed", "failed", "dead_lettered", "cancelled"];

/** Never returns a job's raw `payload` — some job types embed the full
 *  business event body (e.g. webhook.deliver's outbound payload can
 *  carry lead/contact PII, see lib/services/webhooks/dispatcher.ts) and
 *  this is a general-purpose ops screen, not a substitute for each
 *  domain's own detail view. `payloadKeys` (names only, never values)
 *  is enough for an admin to recognize which entity a job relates to —
 *  the mission's own "sensitive payloads must remain protected." */
function redactJob(job: ScheduledJob) {
  const { payload, ...rest } = job;
  // Defensive, not redundant: ScheduledJob.payload's TS type promises
  // Record<string, unknown> (never undefined), but that's a compile-time
  // guarantee only — a persisted document from before payload's schema
  // field existed, or written by anything other than this repository's
  // own create(), can genuinely lack it at runtime. Found live: a real
  // job in this app's own dev database crashed this route with "Cannot
  // convert undefined or null to object" before this guard existed.
  return { ...rest, payloadKeys: Object.keys(payload ?? {}) };
}

/**
 * GET /api/admin/jobs
 *
 * RC-3 — Reliability, Queues & Observability. The admin DLQ/queue
 * visibility panel's list source: every ScheduledJob (this app's real
 * queue — see schedulerService.ts's own doc comment on why there's no
 * separate Redis/BullMQ broker to inspect instead), filterable by
 * status/jobType, paginated, newest-activity first.
 *
 * ALWAYS scoped to the caller's own organizationId from tenant context —
 * never a client-supplied filter for that field, matching the mission's
 * own explicit "Org A jobs must never resolve Org B data" requirement.
 * A caller with no resolvable organizationId (shouldn't happen once
 * requiredRole: "admin" has already required a real authenticated
 * session — see withApiRoute.ts's own organizationId-resolution doc
 * comment) sees an empty list rather than every tenant's jobs.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleListJobs(request: Request): Promise<NextResponse> {
  // A missing organizationId here must never fall through to list()'s
  // own "no filter" behavior (unfiltered = every tenant's jobs) —
  // fail closed instead. See app/api/admin/jobs/[id]/retry's own doc
  // comment for why this same guard is applied at every job-visibility
  // route, not just this one.
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = statusParam && (VALID_STATUSES as string[]).includes(statusParam) ? (statusParam as ScheduledJobStatus) : undefined;

  const filters: ScheduledJobListFilters = {
    status,
    jobType: searchParams.get("jobType") || undefined,
    organizationId,
  };

  const { page, limit } = parsePaginationParams(searchParams);
  const result = await listScheduledJobs(filters, page, limit);
  return apiSuccess({ ...result, items: result.items.map(redactJob) });
}

export const GET = withApiRoute("admin.jobs.list", handleListJobs, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

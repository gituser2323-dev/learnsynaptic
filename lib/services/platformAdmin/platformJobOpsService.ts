import { getScheduledJobRepository } from "@/lib/db";
import { retryScheduledJob, cancelScheduledJob, listScheduledJobs, getQueueMetrics } from "@/lib/services/scheduler";
import type { ScheduledJob, ScheduledJobListFilters } from "@/lib/services/scheduler";
import type { PaginatedResult } from "@/lib/pagination";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console: cross-tenant
 * failed-job/DLQ visibility and safe replay, reusing RC-3's scheduler
 * wholesale (never a second queue-admin implementation) and RC-5's own
 * replay-safety classification (DR_RUNBOOK.md §10.1) rather than
 * re-deriving it.
 *
 * `retryScheduledJob`/`cancelScheduledJob` called with NO organizationId
 * already bypass the tenant-ownership check entirely — their own doc
 * comments (schedulerService.ts) explicitly reserve that for "a
 * genuinely platform-level caller, which doesn't exist yet." This
 * module is that caller.
 */

/** RC-5 §10.1's own classification, reused directly rather than
 *  re-derived: these three job types have a real external side effect
 *  (a WhatsApp message, a webhook POST, a team notification) with NO
 *  idempotency guard against a replay — retrying one of these
 *  unattended risks a real duplicate send to a real recipient. Refused
 *  outright by this platform route rather than silently allowed;
 *  "never blindly replay financial side effects" applies to any
 *  externally-visible side effect here, not just payments literally. */
const MUST_NOT_REPLAY_AUTOMATICALLY = new Set(["webhook.deliver", "notification.deliver", "whatsapp_campaign.send_message"]);

export interface RetryJobResult {
  success: boolean;
  job?: ScheduledJob;
  /** Set only when success is false because of the replay-safety
   *  classification specifically — distinct from "job not found"/"job
   *  isn't in a retryable state" (both still just `success: false`,
   *  same as schedulerService's own retryScheduledJob). */
  refusedReason?: string;
}

export const platformJobOpsService = {
  /** Cross-tenant — every organization's jobs, filterable by status/
   *  jobType/organizationId. ScheduledJob was never tenant-scoped by
   *  the Mongoose plugin to begin with (tenantScopePlugin.ts's own
   *  doc comment), so this already returns across every organization
   *  with no cross-tenant-sweep needed. */
  async listJobs(filters: ScheduledJobListFilters, page: number, limit: number): Promise<PaginatedResult<ScheduledJob>> {
    return listScheduledJobs(filters, page, limit);
  },

  /** Global queue metrics (no organizationId = deployment-wide). */
  async getGlobalQueueMetrics() {
    return getQueueMetrics();
  },

  /** Refuses (never silently no-ops) for a job type RC-5 classified
   *  MUST NOT REPLAY AUTOMATICALLY — the caller sees exactly why,
   *  rather than a job that mysteriously never retries. The
   *  classification check happens BEFORE any mutation, via a direct
   *  lookup, not by inferring it after a failed/successful attempt. */
  async retryJob(id: string, context: AuditContext = {}): Promise<RetryJobResult> {
    const repository = await getScheduledJobRepository();
    const job = await repository.findById(id);
    if (job && MUST_NOT_REPLAY_AUTOMATICALLY.has(job.jobType)) {
      return {
        success: false,
        refusedReason: `"${job.jobType}" jobs are not safe to replay automatically (RC-5 classification — a real external side effect with no idempotency guard). Confirm the underlying send/delivery did not already succeed before retrying this one manually at the database level.`,
      };
    }

    const result = await retryScheduledJob(id);
    if (result.success) {
      await auditLogService.record({
        action: AUDIT_ACTIONS.PLATFORM_JOB_RETRIED,
        entityType: "Organization",
        entityId: result.job?.organizationId ?? "system",
        actorId: context.actorId,
        requestId: context.requestId,
        metadata: { jobId: id, jobType: result.job?.jobType },
      });
    }
    return result;
  },

  /** Cancellation is always safe (a still-pending job simply never
   *  runs) — no replay-safety gate needed, unlike retry. */
  async cancelJob(id: string): Promise<{ success: boolean; job?: ScheduledJob }> {
    return cancelScheduledJob(id);
  },
};

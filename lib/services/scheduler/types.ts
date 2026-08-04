import type { PaginatedResult } from "@/lib/pagination";

/**
 * Shared scheduling infrastructure (Campaign Architecture, approved
 * decision 3): ONE persisted job queue + ONE poller, supporting
 * multiple job types through a common worker architecture — not a
 * separate poller per module. The Automation Engine (its existing
 * `runDueWorkflowSteps()`, completely unmodified) and the new WhatsApp
 * Campaign Manager's message-send/campaign-promotion work both run as
 * registered job types here.
 *
 * See CAMPAIGN_ARCHITECTURE.md §7 for the full reasoning behind the
 * JobOutcome contract below — the short version: different job types
 * want different amounts of "generic retry machinery." A WhatsApp
 * message send wants the scheduler to own attempts/backoff (the
 * approved 3-attempts/1-5-15-minute policy). The Automation Engine
 * already has its own, per-step retry policy that varies *within* a
 * single run — forcing that into one fixed policy per job would be a
 * real behavior change to already-working code. So a job type chooses,
 * per invocation, via what it returns:
 *
 *  - "completed": done, nothing further scheduled.
 *  - "reschedule": run again at an exact time, unconditionally — used
 *    by any handler that manages its own timing (Automation Engine's
 *    per-step delays/retries; a genuinely recurring job like the
 *    automation "tick"). Never touches `attempts`.
 *  - "failed": this attempt failed. Only *this* path consults the
 *    job's own `retryPolicy` (if any) to decide whether to
 *    auto-reschedule with backoff or mark the job permanently failed.
 */

/** RC-3 — "dead_lettered" and "cancelled" are new (Reliability, Queues
 *  & Observability); "pending"/"processing"/"completed"/"failed" are
 *  unchanged, reused as-is (the mission's own "reuse existing states,
 *  don't invent competing terminology" instruction) and already map
 *  directly onto QUEUED/RUNNING/COMPLETED/FAILED. "dead_lettered" is a
 *  more specific, actionable substate of failure — a job that WAS
 *  retry-eligible and exhausted its own retryPolicy, the DLQ view's own
 *  real query target — distinct from a plain "failed" job that was
 *  never retryable in the first place (an unknown job type, a handler
 *  that threw with no retry policy at all). "cancelled" supports the
 *  mission's own "job cancellation where appropriate" — a pending job
 *  an admin explicitly stopped before it ever ran. */
export type ScheduledJobStatus = "pending" | "processing" | "completed" | "failed" | "dead_lettered" | "cancelled";

export interface SchedulerRetryPolicy {
  maxAttempts: number;
  /** Minutes to wait before each successive retry: index 0 = delay
   *  before the 2nd attempt, index 1 = delay before the 3rd, etc. If
   *  `attempts` ever exceeds this array's length, the last entry
   *  repeats (defensive — not expected to matter at the approved
   *  policy's maxAttempts: 3 with a 3-entry array). */
  backoffMinutes: number[];
}

export interface ScheduledJob {
  id: string;
  jobType: string;
  payload: Record<string, unknown>;
  status: ScheduledJobStatus;
  runAt: string;
  /** How many times this job has been attempted. Only meaningful
   *  alongside `retryPolicy` — a job with no retryPolicy that fails is
   *  marked failed after its first (only) attempt. */
  attempts: number;
  retryPolicy?: SchedulerRetryPolicy;
  lastError?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledJobInput {
  jobType: string;
  payload: Record<string, unknown>;
  runAt: string;
  retryPolicy?: SchedulerRetryPolicy;
  /** Business OS Phase 8, Module 8.1 — stamped by enqueueJob() itself
   *  from the enqueuing call's own tenant context; callers don't need
   *  to (and shouldn't) set this directly. Optional here only so
   *  existing call sites that predate this field keep compiling. */
  organizationId?: string;
}

export interface ScheduledJobListFilters {
  status?: ScheduledJobStatus;
  jobType?: string;
  organizationId?: string;
}

/** RC-3 — the admin Reliability panel's one dashboard fetch: queue
 *  depth/DLQ size (read off `countsByStatus`), oldest-pending-job age
 *  (staleness signal — a large value means the poller isn't keeping
 *  up), a retry-rate numerator, and a bounded per-jobType failure
 *  breakdown (the mission's own "per-domain failure counts," capped at
 *  20 job types rather than an unbounded/high-cardinality list). */
export interface QueueMetrics {
  countsByStatus: Record<ScheduledJobStatus, number>;
  /** Age of the longest-overdue pending job — `runAt` in the past only.
   *  A self-rescheduling recurring job (automation.tick and similar)
   *  legitimately stays "pending" with a `runAt` minutes/hours in the
   *  FUTURE between ticks; that's healthy, not staleness, and is
   *  deliberately excluded (found live during RC-3's own browser
   *  verification — including it produced a nonsensical negative age). */
  oldestPendingJobAgeSeconds: number | null;
  /** Count of failed/dead_lettered jobs whose `attempts` exceeded 1 —
   *  the numerator for "retry rate" (denominator is
   *  countsByStatus.failed + countsByStatus.dead_lettered). */
  retriedFailureCount: number;
  failuresByJobType: { jobType: string; count: number }[];
}

export interface ScheduledJobRepository {
  create(input: CreateScheduledJobInput): Promise<ScheduledJob>;
  /** The poller's own query — pending jobs due now, oldest first,
   *  bounded by `limit` (keeps one poller invocation's duration
   *  predictable regardless of total queue size — CAMPAIGN_ARCHITECTURE.md
   *  §12's scalability reasoning). Read-only candidate selection — see
   *  `claim()` below for the real, atomic ownership transfer a caller
   *  MUST perform before treating a candidate as theirs to process. */
  findDue(now: Date, limit: number): Promise<ScheduledJob[]>;
  /** RC-3 — the one real fix for a genuine double-execution race:
   *  atomically transitions a job from "pending" to "processing" ONLY
   *  if it is still "pending" at the moment of the update (a single
   *  conditional `findOneAndUpdate`, not a separate find-then-update).
   *  Returns null if another concurrent poller invocation already
   *  claimed it first — the caller MUST treat that as "skip this job,
   *  someone else has it," never retry the claim or process it anyway.
   *  This is what `findDue()` alone could never guarantee: two
   *  overlapping poller runs (a real Vercel Cron invocation racing an
   *  admin's own manual "Run Due Jobs Now" click, for instance) both
   *  calling `findDue()` before either calls `claim()` would otherwise
   *  both see the same "pending" job and both proceed to execute it. */
  claim(id: string): Promise<ScheduledJob | null>;
  findById(id: string): Promise<ScheduledJob | null>;
  /** DLQ visibility (RC-3) — paginated, filterable browse for the admin
   *  Failed/Dead-Lettered Jobs panel. Newest first. */
  list(filters: ScheduledJobListFilters, page: number, limit: number): Promise<PaginatedResult<ScheduledJob>>;
  /** RC-3 — see QueueMetrics' own doc comment. Scoped by organizationId
   *  the same way `list()` is — omit for a platform-wide view (global,
   *  no-organizationId jobs like automation.tick are never returned
   *  either way when a real organizationId is passed, matching `list()`'s
   *  own exact-match filter semantics). */
  getQueueMetrics(organizationId?: string): Promise<QueueMetrics>;
  update(
    id: string,
    patch: Partial<Pick<ScheduledJob, "status" | "runAt" | "attempts" | "lastError">>,
  ): Promise<ScheduledJob>;
}

export type JobOutcome =
  | { result: "completed" }
  | { result: "reschedule"; runAt: string }
  | { result: "failed"; retryable: boolean; error: string };

/**
 * A handler receives the full job record (not just its payload) on
 * purpose — it needs `attempts`/`retryPolicy` to know whether this is
 * the last allowed try, so it can update its OWN domain state (e.g.
 * mark a Message permanently failed) before returning `"failed"`. The
 * generic scheduler never reaches into a job type's domain models
 * itself — see registerJobHandler() in registry.ts.
 */
export type JobHandler = (job: ScheduledJob) => Promise<JobOutcome>;

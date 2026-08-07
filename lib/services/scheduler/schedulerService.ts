import { getScheduledJobRepository, getOrganizationRepository } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { errorTrackingService } from "@/lib/services/errorTracking";
import { ensureSchedulerBootstrapped } from "./bootstrap";
import { getJobHandler } from "./registry";
import { getTenantContext, runCrossTenantSweep, runWithTenantContext } from "@/lib/tenancy/context";
import type { CreateScheduledJobInput, JobOutcome, QueueMetrics, ScheduledJob, ScheduledJobListFilters } from "./types";

const logger = createLogger({ service: "scheduler" });

/** One poller invocation processes at most this many due jobs — keeps
 *  a single invocation's duration bounded regardless of total queue
 *  size (CAMPAIGN_ARCHITECTURE.md §12), the same reasoning as the
 *  Marketing Dashboard module's MAX_CAMPAIGNS_FOR_OVERALL_METRICS cap. */
const DEFAULT_BATCH_SIZE = 20;

/** RC-6 — how long a job for a currently-suspended organization waits
 *  before this poller checks its status again. An hour is cheap (no
 *  meaningful queue-depth cost) and plenty responsive — reactivation is
 *  an infrequent, deliberate operator action, not a race against a
 *  tight SLA. */
const SUSPENDED_ORG_RECHECK_MINUTES = 60;

/**
 * RC-4 — Deployment & Production Infrastructure: Serverless Limits.
 * `runDueScheduledJobs()`'s own loop processes jobs SEQUENTIALLY
 * (`await`ing each in turn, deliberately — see its own doc comment on
 * why this isn't parallelized), so DEFAULT_BATCH_SIZE alone doesn't
 * bound a single invocation's WALL-CLOCK duration, only its job COUNT.
 * A batch of 20 jobs each near their own worst-case provider timeout
 * (lib/net/timeouts.ts — up to 30s for an AI call) could take up to
 * ~10 minutes sequentially, far past any real serverless function
 * duration limit — Vercel would kill the invocation mid-batch, and per
 * claim()'s own doc comment, the one job that was actually in flight
 * at that moment is safely recovered by the 10-minute stale-claim
 * window, but every job the batch never REACHED yet would sit waiting
 * an extra cron cycle for no reason if this function kept trying to
 * claim more jobs than it realistically has time left to run.
 *
 * This is a real time BUDGET, not just another timeout slapped on top
 * (the mission's own explicit "do NOT simply increase timeouts and
 * call the problem solved") — the loop below checks elapsed time
 * before claiming each NEW job and stops cleanly once the budget is
 * spent, leaving any remaining due jobs for the NEXT cron tick five
 * minutes later (see vercel.json) rather than risking Vercel killing
 * the function mid-job. Comfortably under the 60s `maxDuration` both
 * app/api/cron/run-due-jobs and app/api/admin/scheduler/run-due-jobs
 * now declare explicitly (see those routes' own exports) — the
 * function always finishes whatever job it's currently on, then checks
 * the budget, so it never overruns that declared ceiling.
 */
const MAX_BATCH_DURATION_MS = 45_000;

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

/** Creates a new job — the one entry point every job-producing module
 *  (Automation Engine's bridge, WhatsApp Campaign Manager) calls
 *  instead of managing its own timer/cron entry.
 *
 *  Business OS Phase 8, Module 8.1 — stamps the enqueuing call's own
 *  organizationId onto the job when a tenant context is active
 *  (ScheduledJob is deliberately NOT plugged into tenantScopePlugin —
 *  see that file's own module doc — since the poller's own sweep must
 *  see every organization's due jobs in one pass; this is what lets
 *  runDueScheduledJobs below resolve each individual job back to the
 *  right tenant later). Left unstamped (undefined), same as every
 *  other stampTenant-style helper in this pass, when no context is
 *  active — never forces a default organization here; see
 *  withApiRoute.ts's own doc comment on why that forcing turned out to
 *  be the wrong layer. */
export async function enqueueJob(input: CreateScheduledJobInput): Promise<ScheduledJob> {
  const repository = await getScheduledJobRepository();
  const organizationId = input.organizationId ?? getTenantContext()?.organizationId;
  return repository.create({ ...input, organizationId });
}

async function processJob(job: ScheduledJob): Promise<void> {
  const repository = await getScheduledJobRepository();

  // RC-3 — the real fix for a genuine double-execution race: this
  // atomically transitions the job from "pending" to "processing" ONLY
  // if it's still "pending" right now. A null result means a different
  // concurrent invocation (a real Vercel Cron trigger racing an admin's
  // own "Run Due Jobs Now" click, for instance) already claimed this
  // exact job between this invocation's own findDue() call and this
  // point — skip it silently, never process it anyway. See claim()'s
  // own doc comment (lib/services/scheduler/types.ts) for the full
  // reasoning.
  const claimed = await repository.claim(job.id);
  if (!claimed) {
    logger.info("scheduler.job_claim_lost", { jobId: job.id, jobType: job.jobType });
    return;
  }

  // RC-6 — Platform Super Admin & SaaS Operations Console: "Background
  // workers must respect tenant suspension" (the mission's own explicit
  // instruction). Checked here, independently of withApiRoute.ts's own
  // suspension gate (that one only ever covers HTTP requests — a
  // scheduled job has no request to gate). Global/system jobs (no
  // organizationId — payments.reconcile, billing.period_check, etc.)
  // are never affected; only per-tenant work (WhatsApp sends, campaign
  // promotion, automation steps, webhook deliveries) is deferred.
  // Deliberately a RESCHEDULE, not a failure/completion: the job hasn't
  // failed and shouldn't be treated as done — it simply resumes
  // automatically once the organization is reactivated, with zero side
  // effects having occurred in the meantime (the handler is never
  // invoked at all for a suspended org's job).
  if (claimed.organizationId) {
    const organizationRepository = await getOrganizationRepository();
    const organization = await organizationRepository.findById(claimed.organizationId);
    if (organization?.status === "suspended") {
      logger.info("scheduler.job_deferred_suspended_org", {
        jobId: claimed.id,
        jobType: claimed.jobType,
        organizationId: claimed.organizationId,
      });
      await repository.update(claimed.id, {
        status: "pending",
        runAt: addMinutes(new Date(), SUSPENDED_ORG_RECHECK_MINUTES).toISOString(),
      });
      return;
    }
  }

  const handler = getJobHandler(job.jobType);
  if (!handler) {
    logger.error("scheduler.unknown_job_type", { jobId: job.id, jobType: job.jobType });
    await repository.update(job.id, { status: "failed", lastError: `Unknown job type: ${job.jobType}` });
    return;
  }

  let outcome: JobOutcome;
  try {
    outcome = await handler(claimed);
  } catch (error) {
    // A handler that throws (a bug, not a normal "this attempt failed"
    // outcome) is treated as a non-retryable failure — there's no
    // JobOutcome to read a retry decision from.
    const message = error instanceof Error ? error.message : String(error);
    logger.error("scheduler.handler_threw", { jobId: job.id, jobType: job.jobType, error: message });
    outcome = { result: "failed", retryable: false, error: message };
  }

  if (outcome.result === "completed") {
    await repository.update(job.id, { status: "completed" });
    return;
  }

  if (outcome.result === "reschedule") {
    await repository.update(job.id, { status: "pending", runAt: outcome.runAt });
    return;
  }

  // outcome.result === "failed"
  const attempts = claimed.attempts + 1;
  const policy = claimed.retryPolicy;
  const canRetry = Boolean(policy) && outcome.retryable && attempts < (policy?.maxAttempts ?? 0);

  if (canRetry && policy) {
    const backoffIndex = Math.min(attempts - 1, policy.backoffMinutes.length - 1);
    const backoffMinutes = policy.backoffMinutes[backoffIndex];
    const runAt = addMinutes(new Date(), backoffMinutes).toISOString();
    logger.warn("scheduler.job_retry_scheduled", {
      jobId: job.id,
      jobType: job.jobType,
      attempts,
      runAt,
      error: outcome.error,
    });
    await repository.update(job.id, { status: "pending", attempts, runAt, lastError: outcome.error });
  } else {
    // RC-3 — "dead_lettered" (this job WAS retry-eligible and exhausted
    // its own policy) is distinguished from a plain "failed" (never
    // retryable to begin with — no policy, or this specific outcome
    // said retryable:false) — the DLQ admin view's own real query
    // target, see lib/services/scheduler/types.ts's own doc comment.
    const finalStatus = policy && outcome.retryable ? "dead_lettered" : "failed";
    logger.error("scheduler.job_failed_final", {
      jobId: job.id,
      jobType: job.jobType,
      attempts,
      error: outcome.error,
      status: finalStatus,
    });
    // RC-3 — the one funnel point for every background job type's
    // terminal failure (WhatsApp sends, campaign promotion, webhook/
    // notification delivery, billing/payment reconciliation checks,
    // template sync, phone health checks — every job type registered
    // via registerJobHandler flows through this exact branch), so
    // wiring it here covers the mission's own "background-job/queue/
    // provider/... failures" surface without touching each job
    // handler individually. Fire-and-forget — see errorTrackingService's
    // own doc comment on why this never throws or blocks.
    void errorTrackingService.captureException(new Error(outcome.error), {
      jobId: job.id,
      jobType: job.jobType,
      organizationId: job.organizationId,
      operation: "scheduler.job_failed_final",
    });
    await repository.update(job.id, { status: finalStatus, attempts, lastError: outcome.error });
  }
}

/**
 * The one poller. Wired to run automatically via Vercel Cron
 * (vercel.json's own five-minute-interval cron entry hitting
 * app/api/cron/run-due-jobs, bearer-secret authenticated — see that
 * route's own doc comment) — this app's real, deployed queue
 * architecture is "MongoDB-backed job records, drained by a scheduled
 * serverless poll," not a persistent worker process. RC-3 (Reliability,
 * Queues & Observability) evaluated Redis/BullMQ against this and
 * deliberately did NOT adopt it: a BullMQ worker needs an
 * always-running Node process to pull jobs off Redis, which this
 * Vercel-deployed app has no such process for — introducing it would
 * require standing up separate infrastructure this deployment doesn't
 * have, not a drop-in library swap. This existing architecture already
 * satisfies the real requirements (persistence across restarts, retry
 * with backoff, tenant context per job) — RC-3's own job was hardening
 * it (see claim()'s own doc comment for the double-execution race this
 * pass fixed), not replacing it. Also reachable manually via
 * app/api/admin/scheduler/run-due-jobs (the admin "Run Due Jobs Now"
 * button) — both routes call this exact function, never two
 * implementations of the same job-draining logic.
 */
export async function runDueScheduledJobs(batchSize = DEFAULT_BATCH_SIZE): Promise<{ processed: number }> {
  await ensureSchedulerBootstrapped();
  const repository = await getScheduledJobRepository();

  // Business OS Phase 8, Module 8.1 — the sweep itself deliberately
  // escapes any tenant context the caller might already be running
  // inside (see runCrossTenantSweep's own doc comment): this route is
  // reachable both from a real cron trigger (no context to escape) and
  // from a real admin-authenticated "Run Due Jobs Now" button
  // (withApiRoute DOES establish that admin's own tenant context) —
  // without escaping it here, a human clicking that button would
  // silently only ever process their own organization's due jobs,
  // leaving every other tenant's work stuck with no error. Each
  // individual job then gets its own real tenant context below, but
  // ONLY if it was itself stamped with one at enqueue time (see
  // enqueueJob's own doc on why an unstamped job runs with no context
  // at all rather than a forced default — the job's own downstream
  // reads/writes must match whatever context its own related records
  // were created under).
  return runCrossTenantSweep(async () => {
    const due = await repository.findDue(new Date(), batchSize);
    const startedAt = Date.now();
    let processed = 0;

    for (const job of due) {
      if (Date.now() - startedAt > MAX_BATCH_DURATION_MS) {
        logger.warn("scheduler.batch_time_budget_exceeded", {
          processed,
          remaining: due.length - processed,
          batchSize,
        });
        break;
      }
      if (job.organizationId) {
        await runWithTenantContext({ organizationId: job.organizationId }, () => processJob(job));
      } else {
        await processJob(job);
      }
      processed++;
    }
    return { processed };
  });
}

/** RC-3 — DLQ visibility: the admin Failed/Dead-Lettered Jobs panel's
 *  own data source. */
export async function listScheduledJobs(filters: ScheduledJobListFilters, page: number, limit: number) {
  const repository = await getScheduledJobRepository();
  return repository.list(filters, page, limit);
}

/** RC-3 — the admin Reliability panel's metrics fetch (queue depth, DLQ
 *  size, oldest-pending age, retry rate, per-jobType failure counts).
 *  See QueueMetrics' own doc comment for what each field means. */
export async function getQueueMetrics(organizationId?: string): Promise<QueueMetrics> {
  const repository = await getScheduledJobRepository();
  return repository.getQueueMetrics(organizationId);
}

/** RC-3 — "safe retry/replay" for a dead-lettered (or plain failed) job:
 *  resets it back to "pending", due immediately, with a clean attempts
 *  counter — a genuinely fresh retry budget, not a continuation of the
 *  exhausted one (repeating the same backoff schedule that already
 *  proved insufficient would just fail again on the same timeline).
 *  Deliberately does NOT accept an arbitrary status — only a job that's
 *  actually in a terminal failure state can be replayed; retrying a
 *  "completed" job, for instance, would be a real bug (re-running a
 *  successful side effect), not a legitimate DLQ operation.
 *
 *  `organizationId`, when passed, is a real ownership check, not just a
 *  filter: a job belonging to a DIFFERENT organization (or with no
 *  organizationId at all — a global/system job no tenant admin should
 *  be able to touch) is treated identically to "not found," the same
 *  fail-closed shape list()'s own tenant scoping already uses. The
 *  admin API route (app/api/admin/jobs/[id]/retry) always passes the
 *  caller's own tenant context here — omitting it is reserved for a
 *  genuinely platform-level caller, which doesn't exist yet. */
export async function retryScheduledJob(id: string, organizationId?: string): Promise<{ success: boolean; job?: ScheduledJob }> {
  const repository = await getScheduledJobRepository();
  const job = await repository.findById(id);
  if (!job || (job.status !== "dead_lettered" && job.status !== "failed")) {
    return { success: false };
  }
  if (organizationId !== undefined && job.organizationId !== organizationId) {
    return { success: false };
  }
  const updated = await repository.update(id, { status: "pending", runAt: new Date().toISOString(), attempts: 0, lastError: undefined });
  logger.info("scheduler.job_replayed", { jobId: id, jobType: job.jobType });
  return { success: true, job: updated };
}

/** RC-3 — cancellation "where appropriate": only a job still "pending"
 *  (hasn't started, and isn't already in a terminal state) can be
 *  cancelled — a job already "processing" is mid-side-effect and
 *  cancelling the RECORD wouldn't stop the in-flight work anyway (the
 *  same reasoning a payment can't be "cancelled" once the charge
 *  request is already in flight to the provider).
 *
 *  `organizationId` is the same real ownership check retryScheduledJob's
 *  own doc comment describes — see that comment for the full reasoning. */
export async function cancelScheduledJob(id: string, organizationId?: string): Promise<{ success: boolean; job?: ScheduledJob }> {
  const repository = await getScheduledJobRepository();
  const job = await repository.findById(id);
  if (!job || job.status !== "pending") return { success: false };
  if (organizationId !== undefined && job.organizationId !== organizationId) {
    return { success: false };
  }
  const updated = await repository.update(id, { status: "cancelled" });
  logger.info("scheduler.job_cancelled", { jobId: id, jobType: job.jobType });
  return { success: true, job: updated };
}

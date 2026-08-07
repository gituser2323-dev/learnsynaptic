import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { JobOutcome, ScheduledJob } from "./types";
import type { enqueueJob as EnqueueJob, runDueScheduledJobs as RunDueScheduledJobs } from "./schedulerService";
import type { registerJobHandler as RegisterJobHandler } from "./registry";

/**
 * The scheduler's own due-job selection + retry/backoff branching —
 * exercised only incidentally by the E2E suite today (a real
 * admin-triggered job either succeeds or fails once; nothing there
 * forces N consecutive failures to prove the backoff schedule or the
 * retry-exhaustion cutoff).
 *
 * Two isolation concerns, both handled deliberately rather than
 * discovered by a flaky test later:
 *
 * 1. `runDueScheduledJobs()` calls `ensureSchedulerBootstrapped()`,
 *    which registers every *real* job-producing module's handler
 *    (Automation Engine, WhatsApp Campaign Manager, Task reminders) and
 *    enqueues a real "automation.tick" job due *immediately*. That's
 *    correct production behavior, but it would silently inject an
 *    extra due job into every one of this file's own counts. Those
 *    modules get their own dedicated coverage elsewhere (the automation
 *    engine's own step-advance branching, its own test file) — this
 *    file is only about the generic scheduler mechanics, so
 *    `./bootstrap` is mocked to a no-op here, not exercised.
 * 2. Both the in-memory `ScheduledJob` store and the job-handler
 *    registry are module-level singletons (see
 *    scheduledJob.inMemory.repository.ts / registry.ts) with no reset
 *    method — by design, production code never needs one. `vi.resetModules()`
 *    plus a fresh dynamic import in `beforeEach` gives each test its
 *    own isolated copy of both, rather than leaking jobs or handlers
 *    across test cases.
 */

vi.mock("./bootstrap", () => ({
  ensureSchedulerBootstrapped: vi.fn().mockResolvedValue(undefined),
}));

let enqueueJob: typeof EnqueueJob;
let runDueScheduledJobs: typeof RunDueScheduledJobs;
let registerJobHandler: typeof RegisterJobHandler;
let getScheduledJobRepository: typeof import("@/lib/db").getScheduledJobRepository;
let retryScheduledJob: typeof import("./schedulerService").retryScheduledJob;
let cancelScheduledJob: typeof import("./schedulerService").cancelScheduledJob;
let getQueueMetrics: typeof import("./schedulerService").getQueueMetrics;
let getOrganizationRepository: typeof import("@/lib/db").getOrganizationRepository;

function makeJobType(): string {
  return `unit-test-job-${Math.random().toString(36).slice(2)}`;
}

describe("schedulerService — due-job selection and retry branching", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.resetModules();
    ({ enqueueJob, runDueScheduledJobs, retryScheduledJob, cancelScheduledJob, getQueueMetrics } = await import("./schedulerService"));
    ({ registerJobHandler } = await import("./registry"));
    ({ getScheduledJobRepository, getOrganizationRepository } = await import("@/lib/db"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("only processes jobs whose runAt has passed, ignoring future-dated ones", async () => {
    const jobType = makeJobType();
    const calls: ScheduledJob[] = [];
    registerJobHandler(jobType, async (job) => {
      calls.push(job);
      return { result: "completed" } satisfies JobOutcome;
    });

    const now = new Date();
    await enqueueJob({ jobType, payload: { which: "due" }, runAt: now.toISOString() });
    await enqueueJob({ jobType, payload: { which: "future" }, runAt: new Date(now.getTime() + 60_000).toISOString() });

    const { processed } = await runDueScheduledJobs();
    expect(processed).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].payload.which).toBe("due");
  });

  it("processes due jobs oldest-first", async () => {
    const jobType = makeJobType();
    const order: string[] = [];
    registerJobHandler(jobType, async (job) => {
      order.push(job.payload.label as string);
      return { result: "completed" };
    });

    const now = new Date();
    await enqueueJob({ jobType, payload: { label: "second" }, runAt: new Date(now.getTime() - 1000).toISOString() });
    await enqueueJob({ jobType, payload: { label: "first" }, runAt: new Date(now.getTime() - 5000).toISOString() });

    await runDueScheduledJobs();
    expect(order).toEqual(["first", "second"]);
  });

  it("respects batchSize — a poll never processes more than the given limit in one call", async () => {
    const jobType = makeJobType();
    let callCount = 0;
    registerJobHandler(jobType, async () => {
      callCount++;
      return { result: "completed" };
    });

    const now = new Date();
    for (let i = 0; i < 5; i++) {
      await enqueueJob({ jobType, payload: { i }, runAt: now.toISOString() });
    }

    const first = await runDueScheduledJobs(2);
    expect(first.processed).toBe(2);
    expect(callCount).toBe(2);

    const second = await runDueScheduledJobs(2);
    expect(second.processed).toBe(2);
    expect(callCount).toBe(4);

    const third = await runDueScheduledJobs(2);
    expect(third.processed).toBe(1);
    expect(callCount).toBe(5);
  });

  it("a 'reschedule' outcome moves runAt forward without counting as a failed attempt", async () => {
    const jobType = makeJobType();
    const attemptsSeen: number[] = [];
    let call = 0;
    registerJobHandler(jobType, async (job) => {
      attemptsSeen.push(job.attempts);
      call++;
      if (call === 1) return { result: "reschedule", runAt: new Date(Date.now() + 30 * 60_000).toISOString() };
      return { result: "completed" };
    });

    await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString() });
    await runDueScheduledJobs();
    expect(attemptsSeen).toEqual([0]);

    // Not due yet — still 29 minutes away.
    await vi.advanceTimersByTimeAsync(29 * 60_000);
    expect((await runDueScheduledJobs()).processed).toBe(0);

    // Now due.
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await runDueScheduledJobs()).processed).toBe(1);
    expect(attemptsSeen).toEqual([0, 0]); // reschedule never touched `attempts`
  });

  it("a retryable failure schedules the next attempt using retryPolicy.backoffMinutes, indexed by attempt", async () => {
    const jobType = makeJobType();
    const attemptsSeen: number[] = [];
    registerJobHandler(jobType, async (job) => {
      attemptsSeen.push(job.attempts);
      return { result: "failed", retryable: true, error: "always fails" };
    });

    await enqueueJob({
      jobType,
      payload: {},
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 3, backoffMinutes: [5, 15] },
    });

    // Attempt 1 (job.attempts starts at 0) fails -> attempts becomes 1,
    // rescheduled 5 minutes out (backoffMinutes[0]).
    await runDueScheduledJobs();
    expect(attemptsSeen).toEqual([0]);
    expect((await runDueScheduledJobs()).processed).toBe(0); // not due yet

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await runDueScheduledJobs();
    expect(attemptsSeen).toEqual([0, 1]); // attempt 2, backoffMinutes[1] = 15 next

    await vi.advanceTimersByTimeAsync(14 * 60_000);
    expect((await runDueScheduledJobs()).processed).toBe(0); // 14 < 15, not due yet

    await vi.advanceTimersByTimeAsync(60_000);
    await runDueScheduledJobs();
    // attempts is now 2 going into the 3rd (final, maxAttempts=3) call —
    // this failure exhausts retries, so no further reschedule happens.
    expect(attemptsSeen).toEqual([0, 1, 2]);

    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000); // a full day later
    expect((await runDueScheduledJobs()).processed).toBe(0); // job is "failed", never due again
  });

  it("repeats the last backoffMinutes entry if attempts exceeds the array length", async () => {
    const jobType = makeJobType();
    const attemptsSeen: number[] = [];
    registerJobHandler(jobType, async (job) => {
      attemptsSeen.push(job.attempts);
      return { result: "failed", retryable: true, error: "always fails" };
    });

    await enqueueJob({
      jobType,
      payload: {},
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 4, backoffMinutes: [1] }, // only one entry
    });

    await runDueScheduledJobs(); // attempts 0 -> 1, backoffMinutes[min(0,0)]=1min
    await vi.advanceTimersByTimeAsync(60_000);
    await runDueScheduledJobs(); // attempts 1 -> 2, backoffMinutes[min(1,0)]=1min (repeats last)
    await vi.advanceTimersByTimeAsync(60_000);
    await runDueScheduledJobs(); // attempts 2 -> 3
    expect(attemptsSeen).toEqual([0, 1, 2]);
  });

  it("a non-retryable failure is marked failed immediately, even with maxAttempts remaining", async () => {
    const jobType = makeJobType();
    let callCount = 0;
    registerJobHandler(jobType, async () => {
      callCount++;
      return { result: "failed", retryable: false, error: "permanent" };
    });

    await enqueueJob({
      jobType,
      payload: {},
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 5, backoffMinutes: [1, 2, 3] },
    });

    await runDueScheduledJobs();
    expect(callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect((await runDueScheduledJobs()).processed).toBe(0); // never rescheduled
  });

  it("a job with no retryPolicy at all fails permanently after its one attempt", async () => {
    const jobType = makeJobType();
    let callCount = 0;
    registerJobHandler(jobType, async () => {
      callCount++;
      return { result: "failed", retryable: true, error: "no policy to retry against" };
    });

    await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString() });
    await runDueScheduledJobs();
    expect(callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect((await runDueScheduledJobs()).processed).toBe(0);
  });

  it("a handler that throws is treated as a non-retryable failure, not left stuck", async () => {
    const jobType = makeJobType();
    let callCount = 0;
    registerJobHandler(jobType, async () => {
      callCount++;
      throw new Error("bug, not a normal failure outcome");
    });

    await enqueueJob({
      jobType,
      payload: {},
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 5, backoffMinutes: [1] },
    });

    await runDueScheduledJobs();
    expect(callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect((await runDueScheduledJobs()).processed).toBe(0); // not retried despite maxAttempts: 5
  });

  it("RC-3 — pentest/failure-simulation: a poison job (always throws) never blocks the rest of the batch — healthy jobs in the same runDueScheduledJobs() call still complete", async () => {
    const poisonType = makeJobType();
    const healthyType = makeJobType();
    registerJobHandler(poisonType, async () => {
      throw new Error("poison job — always throws, simulating a genuinely broken handler");
    });
    let healthyRuns = 0;
    registerJobHandler(healthyType, async () => {
      healthyRuns++;
      return { result: "completed" };
    });

    // Poison job enqueued FIRST — if processJob's own per-job try/catch
    // (see schedulerService.ts) didn't contain the throw, a naive
    // for-loop over findDue()'s results would abort here and the
    // healthy job below would never run.
    await enqueueJob({ jobType: poisonType, payload: {}, runAt: new Date().toISOString() });
    await enqueueJob({ jobType: healthyType, payload: {}, runAt: new Date().toISOString() });

    const { processed } = await runDueScheduledJobs();
    expect(processed).toBe(2); // both jobs were attempted in the same batch.
    expect(healthyRuns).toBe(1); // the healthy job actually ran, not skipped.

    const repository = await getScheduledJobRepository();
    const poisonJob = (await repository.list({ jobType: poisonType }, 1, 10)).items[0];
    const healthyJob = (await repository.list({ jobType: healthyType }, 1, 10)).items[0];
    expect(poisonJob.status).toBe("failed");
    expect(healthyJob.status).toBe("completed");
  });

  it("RC-4 — Serverless Limits: a batch that would run too long stops claiming NEW jobs once its time budget is spent, leaving the rest pending for the next cron tick", async () => {
    const jobType = makeJobType();
    let runs = 0;
    // Each job's own handler simulates real wall-clock work by
    // advancing the fake clock — MAX_BATCH_DURATION_MS (45s) is spent
    // after the 3rd job (3 x 20s = 60s > 45s checked BEFORE claiming a
    // 4th), so the 4th enqueued job must never even be attempted.
    registerJobHandler(jobType, async () => {
      runs++;
      await vi.advanceTimersByTimeAsync(20_000);
      return { result: "completed" };
    });

    for (let i = 0; i < 4; i++) {
      await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString() });
    }

    const { processed } = await runDueScheduledJobs();

    expect(processed).toBe(3);
    expect(runs).toBe(3);

    const repository = await getScheduledJobRepository();
    const jobs = (await repository.list({ jobType }, 1, 10)).items;
    const completed = jobs.filter((j) => j.status === "completed");
    const stillPending = jobs.filter((j) => j.status === "pending");
    expect(completed).toHaveLength(3);
    expect(stillPending).toHaveLength(1); // left for the next cron tick, not lost or stuck.
  });

  it("an unknown job type is marked failed without ever calling a handler", async () => {
    await enqueueJob({ jobType: "no-such-job-type", payload: {}, runAt: new Date().toISOString() });
    const { processed } = await runDueScheduledJobs();
    expect(processed).toBe(1); // still counted as "processed" (attempted), just resolved as failed

    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect((await runDueScheduledJobs()).processed).toBe(0); // not retried
  });

  describe("RC-3 — pentest: concurrent poller invocations never double-process a job", () => {
    it("repository.claim() is the real atomic gate: a second claim on the same id, after the first succeeded, returns null", async () => {
      const repository = await getScheduledJobRepository();
      const job = await repository.create({ jobType: "x", payload: {}, runAt: new Date().toISOString() });

      const first = await repository.claim(job.id);
      expect(first).not.toBeNull();
      expect(first!.status).toBe("processing");

      const second = await repository.claim(job.id);
      expect(second).toBeNull();
    });

    it("claim() returns null for a job that was never pending in the first place (already completed)", async () => {
      const repository = await getScheduledJobRepository();
      const job = await repository.create({ jobType: "x", payload: {}, runAt: new Date().toISOString() });
      await repository.update(job.id, { status: "completed" });
      expect(await repository.claim(job.id)).toBeNull();
    });

    it("simulates the real race: a second poller invocation claiming the SAME job mid-handler-execution sees it as already taken, and the handler runs exactly once", async () => {
      const jobType = makeJobType();
      let handlerInvocations = 0;
      let raceResult: unknown = "not yet attempted";

      registerJobHandler(jobType, async (job) => {
        handlerInvocations++;
        // While this (the FIRST, legitimate) invocation is still inside
        // its own handler — the exact window a real overlapping Vercel
        // Cron trigger / manual "Run Due Jobs Now" click would race
        // in — a second invocation attempts to claim the identical job
        // id directly against the repository.
        const repository = await getScheduledJobRepository();
        raceResult = await repository.claim(job.id);
        return { result: "completed" };
      });

      const job = await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString() });
      await runDueScheduledJobs();

      expect(handlerInvocations).toBe(1);
      expect(raceResult).toBeNull(); // the "second poller" never got to treat this job as its own.

      const repository = await getScheduledJobRepository();
      const finalState = await repository.findById(job.id);
      expect(finalState!.status).toBe("completed"); // exactly one real completion, not corrupted by the race attempt.
    });
  });

  describe("RC-3 — dead-letter queue: state distinction, retry/replay, cancellation", () => {
    it("a retry-eligible job that exhausts its retryPolicy is marked dead_lettered (not plain failed)", async () => {
      const jobType = makeJobType();
      registerJobHandler(jobType, async () => ({ result: "failed", retryable: true, error: "always fails" }));

      await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString(), retryPolicy: { maxAttempts: 1, backoffMinutes: [5] } });
      await runDueScheduledJobs();

      const repository = await getScheduledJobRepository();
      const [job] = (await repository.list({ jobType }, 1, 10)).items;
      expect(job.status).toBe("dead_lettered");
    });

    it("a job with no retryPolicy at all is still plain 'failed', not dead_lettered (it was never retry-eligible)", async () => {
      const jobType = makeJobType();
      registerJobHandler(jobType, async () => ({ result: "failed", retryable: true, error: "no policy" }));

      await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString() });
      await runDueScheduledJobs();

      const repository = await getScheduledJobRepository();
      const [job] = (await repository.list({ jobType }, 1, 10)).items;
      expect(job.status).toBe("failed");
    });

    it("retryScheduledJob resets a dead_lettered job to pending with a fresh attempts budget, and it then re-runs", async () => {
      const jobType = makeJobType();
      let calls = 0;
      registerJobHandler(jobType, async () => {
        calls++;
        return { result: "failed", retryable: true, error: "fails" };
      });

      const job = await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString(), retryPolicy: { maxAttempts: 1, backoffMinutes: [5] } });
      await runDueScheduledJobs();
      expect(calls).toBe(1);

      const replay = await retryScheduledJob(job.id);
      expect(replay.success).toBe(true);
      expect(replay.job!.status).toBe("pending");
      expect(replay.job!.attempts).toBe(0);

      await runDueScheduledJobs();
      expect(calls).toBe(2); // actually re-ran, not just relabeled.
    });

    it("retryScheduledJob refuses to replay a job that isn't in a terminal failure state (e.g. still pending)", async () => {
      const jobType = makeJobType();
      registerJobHandler(jobType, async () => ({ result: "completed" }));
      const job = await enqueueJob({ jobType, payload: {}, runAt: new Date(Date.now() + 60_000).toISOString() });

      const result = await retryScheduledJob(job.id);
      expect(result.success).toBe(false);
    });

    it("cancelScheduledJob cancels a pending job, which then never runs", async () => {
      const jobType = makeJobType();
      let calls = 0;
      registerJobHandler(jobType, async () => {
        calls++;
        return { result: "completed" };
      });
      const job = await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString() });

      const result = await cancelScheduledJob(job.id);
      expect(result.success).toBe(true);
      expect(result.job!.status).toBe("cancelled");

      expect((await runDueScheduledJobs()).processed).toBe(0);
      expect(calls).toBe(0);
    });

    it("cancelScheduledJob refuses to cancel a job that's already processing/completed", async () => {
      const jobType = makeJobType();
      registerJobHandler(jobType, async () => ({ result: "completed" }));
      const job = await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString() });
      await runDueScheduledJobs(); // now completed

      const result = await cancelScheduledJob(job.id);
      expect(result.success).toBe(false);
    });
  });

  describe("RC-3 — pentest: cross-tenant DLQ retry/cancel is blocked", () => {
    it("retryScheduledJob refuses to replay a dead_lettered job owned by a DIFFERENT organization", async () => {
      const jobType = makeJobType();
      registerJobHandler(jobType, async () => ({ result: "failed", retryable: true, error: "always fails" }));
      const job = await enqueueJob({
        jobType,
        payload: {},
        runAt: new Date().toISOString(),
        retryPolicy: { maxAttempts: 1, backoffMinutes: [5] },
        organizationId: "org-a",
      });
      await runDueScheduledJobs();

      const crossTenantAttempt = await retryScheduledJob(job.id, "org-b");
      expect(crossTenantAttempt.success).toBe(false);

      const sameOrgAttempt = await retryScheduledJob(job.id, "org-a");
      expect(sameOrgAttempt.success).toBe(true);
    });

    it("retryScheduledJob refuses to replay a job with no organizationId at all when a real org calls it (a global/system job)", async () => {
      const jobType = makeJobType();
      registerJobHandler(jobType, async () => ({ result: "failed", retryable: true, error: "always fails" }));
      const job = await enqueueJob({
        jobType,
        payload: {},
        runAt: new Date().toISOString(),
        retryPolicy: { maxAttempts: 1, backoffMinutes: [5] },
      });
      await runDueScheduledJobs();

      const result = await retryScheduledJob(job.id, "org-a");
      expect(result.success).toBe(false);
    });

    it("cancelScheduledJob refuses to cancel a pending job owned by a DIFFERENT organization", async () => {
      const jobType = makeJobType();
      registerJobHandler(jobType, async () => ({ result: "completed" }));
      const job = await enqueueJob({ jobType, payload: {}, runAt: new Date(Date.now() + 60_000).toISOString(), organizationId: "org-a" });

      const crossTenantAttempt = await cancelScheduledJob(job.id, "org-b");
      expect(crossTenantAttempt.success).toBe(false);

      const sameOrgAttempt = await cancelScheduledJob(job.id, "org-a");
      expect(sameOrgAttempt.success).toBe(true);
    });
  });

  describe("RC-3 — getQueueMetrics: counts, oldest-pending age, retry rate, tenant scoping", () => {
    it("reports counts by status, oldest-pending age, and a retried-failure count, scoped to one organization", async () => {
      const jobType = makeJobType();
      registerJobHandler(jobType, async () => ({ result: "failed", retryable: true, error: "always fails" }));

      // org-a: one dead_lettered job that took 2 attempts (maxAttempts:2), one still-pending job.
      await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString(), retryPolicy: { maxAttempts: 2, backoffMinutes: [5, 5] }, organizationId: "org-a" });
      await runDueScheduledJobs(); // attempt 1 -> retry scheduled
      vi.setSystemTime(new Date("2026-01-01T00:10:00.000Z"));
      await runDueScheduledJobs(); // attempt 2 -> exhausted -> dead_lettered

      // org-b: a completely separate dead_lettered job — must never appear in
      // org-a's metrics. Processed here, BEFORE org-a's still-pending job
      // below is enqueued, since runDueScheduledJobs() sweeps every due job
      // across every organization in one pass (by design — see
      // runCrossTenantSweep's own doc comment) — an overdue org-a job
      // enqueued before this sweep would get silently processed by it too.
      await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString(), retryPolicy: { maxAttempts: 1, backoffMinutes: [5] }, organizationId: "org-b" });
      await runDueScheduledJobs();

      // Overdue by 30s (runAt in the past) — a genuine "waiting" pending job,
      // added after the last sweep so it stays pending for this assertion.
      await enqueueJob({ jobType, payload: {}, runAt: new Date(Date.now() - 30_000).toISOString(), organizationId: "org-a" });

      const metrics = await getQueueMetrics("org-a");
      expect(metrics.countsByStatus.dead_lettered).toBe(1);
      expect(metrics.countsByStatus.pending).toBe(1);
      expect(metrics.retriedFailureCount).toBe(1); // the org-a job that needed 2 attempts.
      expect(metrics.oldestPendingJobAgeSeconds).toBe(30);
      expect(metrics.failuresByJobType).toEqual([{ jobType, count: 1 }]); // org-b's failure excluded.
    });

    it("pentest/regression — a pending job scheduled for the FUTURE (a self-rescheduling recurring job) is never picked as 'oldest pending': null, not negative", async () => {
      // Found live during RC-3's own browser verification: automation.tick
      // and similar self-rescheduling jobs stay "pending" with a runAt
      // minutes in the future between ticks — a healthy state that
      // previously produced a nonsensical NEGATIVE age here.
      const jobType = makeJobType();
      await enqueueJob({ jobType, payload: {}, runAt: new Date(Date.now() + 5 * 60_000).toISOString(), organizationId: "org-a" });

      const metrics = await getQueueMetrics("org-a");
      expect(metrics.countsByStatus.pending).toBe(1);
      expect(metrics.oldestPendingJobAgeSeconds).toBeNull();
    });
  });

  describe("RC-6 — tenant suspension: background workers must respect it", () => {
    it("a due job for a SUSPENDED organization is never executed — deferred (still 'pending', rescheduled) instead", async () => {
      const orgRepo = await getOrganizationRepository();
      const org = await orgRepo.create({ name: "Suspended Scheduler Test Org", slug: `suspended-sched-${Math.random().toString(36).slice(2)}` });
      await orgRepo.update(org.id, { status: "suspended", suspendedAt: new Date().toISOString(), suspendedReason: "test" });

      const jobType = makeJobType();
      let handlerCalled = false;
      registerJobHandler(jobType, async () => {
        handlerCalled = true;
        return { result: "completed" } satisfies JobOutcome;
      });
      await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString(), organizationId: org.id });

      const result = await runDueScheduledJobs();

      // "processed" counts jobs this poll cycle looked at, not jobs
      // whose handler actually ran — a deferred job was still visited
      // (claimed, checked, rescheduled), same as every other outcome
      // branch in processJob().
      expect(handlerCalled).toBe(false);
      expect(result.processed).toBe(1);

      const repository = await getScheduledJobRepository();
      const jobs = await repository.list({ jobType }, 1, 10);
      expect(jobs.items[0]?.status).toBe("pending");
      // Rescheduled into the future (SUSPENDED_ORG_RECHECK_MINUTES), not
      // left at its original past-due runAt — a second immediate poll
      // must not busy-loop re-checking the same suspended job forever.
      expect(new Date(jobs.items[0]!.runAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("a due job for an ACTIVE organization executes normally — the suspension check is not a blanket regression", async () => {
      const orgRepo = await getOrganizationRepository();
      const org = await orgRepo.create({ name: "Active Scheduler Test Org", slug: `active-sched-${Math.random().toString(36).slice(2)}` });

      const jobType = makeJobType();
      let handlerCalled = false;
      registerJobHandler(jobType, async () => {
        handlerCalled = true;
        return { result: "completed" } satisfies JobOutcome;
      });
      await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString(), organizationId: org.id });

      const result = await runDueScheduledJobs();

      expect(handlerCalled).toBe(true);
      expect(result.processed).toBe(1);
    });

    it("a global/system job with no organizationId is never affected by any organization's suspension state", async () => {
      const jobType = makeJobType();
      let handlerCalled = false;
      registerJobHandler(jobType, async () => {
        handlerCalled = true;
        return { result: "completed" } satisfies JobOutcome;
      });
      await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString() });

      const result = await runDueScheduledJobs();

      expect(handlerCalled).toBe(true);
      expect(result.processed).toBe(1);
    });
  });
});

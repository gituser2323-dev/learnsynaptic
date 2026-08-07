import { describe, it, expect, vi, beforeEach } from "vitest";
import type { enqueueJob as EnqueueJob } from "@/lib/services/scheduler/schedulerService";
import type { registerJobHandler as RegisterJobHandler } from "@/lib/services/scheduler/registry";

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console: the one
 * genuinely safety-critical behavior in the platform job-ops surface —
 * refusing to replay a job type RC-5 classified MUST NOT REPLAY
 * AUTOMATICALLY (a real external side effect with no idempotency
 * guard). Same `vi.resetModules()` + fresh dynamic import isolation
 * pattern schedulerService.unit.test.ts already establishes (module-
 * level in-memory singletons, no reset method by design).
 */
vi.mock("@/lib/services/scheduler/bootstrap", () => ({
  ensureSchedulerBootstrapped: vi.fn().mockResolvedValue(undefined),
}));

let enqueueJob: typeof EnqueueJob;
let registerJobHandler: typeof RegisterJobHandler;
let platformJobOpsService: typeof import("./platformJobOpsService").platformJobOpsService;

beforeEach(async () => {
  vi.resetModules();
  ({ enqueueJob } = await import("@/lib/services/scheduler/schedulerService"));
  ({ registerJobHandler } = await import("@/lib/services/scheduler/registry"));
  ({ platformJobOpsService } = await import("./platformJobOpsService"));
});

async function makeDeadLetteredJob(jobType: string): Promise<string> {
  registerJobHandler(jobType, async () => ({ result: "failed", retryable: false, error: "test failure" }));
  const job = await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString(), retryPolicy: { maxAttempts: 1, backoffMinutes: [1] } });
  // Directly mark it dead_lettered via the real repository, mirroring
  // how schedulerService.unit.test.ts's own retry-exhaustion tests do
  // this — retrying is only meaningful against a real dead_lettered/
  // failed row.
  const { getScheduledJobRepository } = await import("@/lib/db");
  const repository = await getScheduledJobRepository();
  await repository.update(job.id, { status: "dead_lettered", lastError: "test failure" });
  return job.id;
}

describe("platformJobOpsService.retryJob — RC-6 replay-safety enforcement", () => {
  it("refuses to retry a 'whatsapp_campaign.send_message' job — a real external side effect with no idempotency guard", async () => {
    const jobId = await makeDeadLetteredJob("whatsapp_campaign.send_message");
    const result = await platformJobOpsService.retryJob(jobId);
    expect(result.success).toBe(false);
    expect(result.refusedReason).toMatch(/not safe to replay automatically/);
  });

  it("refuses to retry a 'webhook.deliver' job", async () => {
    const jobId = await makeDeadLetteredJob("webhook.deliver");
    const result = await platformJobOpsService.retryJob(jobId);
    expect(result.success).toBe(false);
    expect(result.refusedReason).toBeDefined();
  });

  it("refuses to retry a 'notification.deliver' job", async () => {
    const jobId = await makeDeadLetteredJob("notification.deliver");
    const result = await platformJobOpsService.retryJob(jobId);
    expect(result.success).toBe(false);
    expect(result.refusedReason).toBeDefined();
  });

  it("allows retrying a job type NOT in the must-not-replay list (e.g. a generic/safe job type)", async () => {
    const jobType = `unit-test-safe-job-${Math.random().toString(36).slice(2)}`;
    const jobId = await makeDeadLetteredJob(jobType);
    const result = await platformJobOpsService.retryJob(jobId);
    expect(result.success).toBe(true);
    expect(result.refusedReason).toBeUndefined();
    expect(result.job?.status).toBe("pending");
  });

  it("crosses tenant ownership freely — retries a job belonging to ANY organization, not just the caller's own (the platform-level bypass schedulerService.ts's own retryScheduledJob doc comment describes)", async () => {
    const jobType = `unit-test-cross-org-${Math.random().toString(36).slice(2)}`;
    registerJobHandler(jobType, async () => ({ result: "failed", retryable: false, error: "test" }));
    const job = await enqueueJob({ jobType, payload: {}, runAt: new Date().toISOString(), organizationId: "some-other-real-org-id" });
    const { getScheduledJobRepository } = await import("@/lib/db");
    const repository = await getScheduledJobRepository();
    await repository.update(job.id, { status: "failed" });

    const result = await platformJobOpsService.retryJob(job.id);
    expect(result.success).toBe(true);
    expect(result.job?.organizationId).toBe("some-other-real-org-id");
  });

  it("cancelJob has no replay-safety gate — cancelling a must-not-replay job type's still-pending row is always allowed (it never runs)", async () => {
    const jobType = "whatsapp_campaign.send_message";
    registerJobHandler(jobType, async () => ({ result: "completed" as const }));
    const job = await enqueueJob({ jobType, payload: {}, runAt: new Date(Date.now() + 60_000).toISOString() });
    const result = await platformJobOpsService.cancelJob(job.id);
    expect(result.success).toBe(true);
    expect(result.job?.status).toBe("cancelled");
  });
});

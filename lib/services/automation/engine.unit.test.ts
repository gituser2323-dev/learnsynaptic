import { describe, it, expect, vi } from "vitest";
import { startWorkflowRun, advanceWorkflowRun } from "./engine";
import { createWorkflowDefinition } from "./definitions";
import { leadService } from "@/lib/services/leads";
import { registrationService } from "@/lib/services/registrations";
import type { PersistedWorkflowStep } from "./types";

/**
 * The automation engine's step-advance branching (condition skip vs.
 * run, retry-then-fail, retry-then-succeed) — exercised only
 * incidentally by the E2E suite today (automation.spec.ts drives the
 * admin UI through a single successful step; nothing there forces a
 * step to fail N times to prove the linear backoff math or the
 * retry-exhaustion cutoff).
 *
 * Deliberately uses real production executors (`add_tag`,
 * `lead_not_registered`) via a real, persisted WorkflowDefinition and
 * the real in-memory Lead/Registration repositories — not hand-rolled
 * fakes — so these tests protect the actual registry wiring
 * (hydrateWorkflowDefinition → actionRegistry/conditionRegistry), not a
 * parallel model of it. The in-memory `WorkflowRun` repository hands
 * back the same mutable object on every `update()` (see
 * workflowRun.inMemory.repository.ts), so the `run` reference returned
 * by `startWorkflowRun()` reflects every later mutation
 * `advanceWorkflowRun()` makes to it directly — no separate re-fetch
 * needed between calls.
 */

let wfCounter = 0;
function uniqueId(prefix: string): string {
  wfCounter += 1;
  return `${prefix}-${Date.now()}-${wfCounter}`;
}

async function createLead(): Promise<string> {
  const suffix = uniqueId("lead");
  const result = await leadService.registerLead({
    name: "Engine Unit Test Lead",
    email: `${suffix}@example.com`,
    phone: `+9198765${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`,
    source: "unit-test",
  });
  if (!result.success) throw new Error(`Failed to create test lead: ${JSON.stringify(result.errors)}`);
  return result.lead.id;
}

async function defineWorkflow(steps: PersistedWorkflowStep[]) {
  const result = await createWorkflowDefinition({
    id: uniqueId("unit-test-wf"),
    name: "Engine unit test workflow",
    triggerEventType: "unit-test-trigger", // never actually published — this test drives the engine directly
    active: true,
    steps,
  });
  if (!result.success) throw new Error(`Failed to create test workflow definition: ${JSON.stringify(result.errors)}`);
  return result.definition;
}

describe("automation engine — step-advance branching", () => {
  it("condition true: the step's action executes and the run completes", async () => {
    const leadId = await createLead();
    const definition = await defineWorkflow([
      {
        id: "tag-step",
        action: { type: "add_tag", params: { tagId: "unit-test-tag" } },
        condition: { type: "lead_not_registered", description: "skip if already registered" },
      },
    ]);

    const run = await startWorkflowRun(definition.id, "Lead", leadId, {});
    await advanceWorkflowRun(run);

    expect(run.status).toBe("completed");
    expect(run.completionReason).toBe("sequence_finished");
    const lead = await leadService.getLead(leadId);
    expect(lead?.tags).toContain("unit-test-tag");
  });

  it("condition false: the step is skipped, its action never runs, and the run still advances", async () => {
    const leadId = await createLead();
    const registrationResult = await registrationService.createRegistration({
      leadId,
      programSlug: "genai-builder",
      source: "unit-test",
    });
    expect(registrationResult.success).toBe(true);

    const definition = await defineWorkflow([
      {
        id: "tag-step",
        action: { type: "add_tag", params: { tagId: "should-never-be-added" } },
        condition: { type: "lead_not_registered", description: "skip if already registered" },
      },
    ]);

    const run = await startWorkflowRun(definition.id, "Lead", leadId, {});
    await advanceWorkflowRun(run);

    expect(run.status).toBe("completed"); // still advances past the skipped step
    const lead = await leadService.getLead(leadId);
    expect(lead?.tags ?? []).not.toContain("should-never-be-added");
  });

  it("an action that fails every attempt exhausts retries and marks the run permanently failed", async () => {
    const definition = await defineWorkflow([
      {
        id: "always-fails",
        action: { type: "add_tag", params: { tagId: "irrelevant" } }, // entityId below never resolves to a real Lead
        retryPolicy: { maxAttempts: 2, backoff: { amount: 5, unit: "minutes" } },
      },
    ]);

    const run = await startWorkflowRun(definition.id, "Lead", "no-such-lead-id", {});

    await advanceWorkflowRun(run);
    expect(run.status).toBe("waiting");
    expect(run.attempts).toBe(1);
    expect(run.lastError).toMatch(/not found/i);
    // Linear backoff: policy.backoff.amount * attempts = 5 * 1 = 5 minutes.
    const expectedFirstRetry = Date.now() + 5 * 60_000;
    expect(new Date(run.nextRunAt).getTime()).toBeCloseTo(expectedFirstRetry, -3);

    await advanceWorkflowRun(run);
    expect(run.status).toBe("failed");
    expect(run.attempts).toBe(2); // attempts >= maxAttempts (2) -> exhausted, no further retry
  });

  it("backoff grows linearly with attempt number (backoff.amount * attempts), not exponentially", async () => {
    const definition = await defineWorkflow([
      {
        id: "always-fails",
        action: { type: "add_tag", params: { tagId: "irrelevant" } },
        retryPolicy: { maxAttempts: 4, backoff: { amount: 10, unit: "minutes" } },
      },
    ]);

    const run = await startWorkflowRun(definition.id, "Lead", "no-such-lead-id", {});

    await advanceWorkflowRun(run); // attempts -> 1, next = +10min (10*1)
    const afterFirst = new Date(run.nextRunAt).getTime();
    expect(afterFirst - Date.now()).toBeCloseTo(10 * 60_000, -3);

    await advanceWorkflowRun(run); // attempts -> 2, next = +20min (10*2)
    const afterSecond = new Date(run.nextRunAt).getTime();
    expect(afterSecond - Date.now()).toBeCloseTo(20 * 60_000, -3);

    await advanceWorkflowRun(run); // attempts -> 3, next = +30min (10*3)
    const afterThird = new Date(run.nextRunAt).getTime();
    expect(afterThird - Date.now()).toBeCloseTo(30 * 60_000, -3);

    expect(run.status).toBe("waiting"); // maxAttempts is 4, still one retry left
  });

  it("an action that fails once then succeeds recovers within the retry budget and completes", async () => {
    const leadId = await createLead();
    const definition = await defineWorkflow([
      {
        id: "flaky-tag-step",
        action: { type: "add_tag", params: { tagId: "recovered-tag" } },
        retryPolicy: { maxAttempts: 3, backoff: { amount: 1, unit: "minutes" } },
      },
    ]);

    const run = await startWorkflowRun(definition.id, "Lead", leadId, {});

    // One deliberate synthetic failure — the same technique any test
    // suite uses to prove a retry path recovers from a transient error
    // without needing a real flaky external system. Every other call
    // still hits the real leadService implementation.
    const getLeadSpy = vi.spyOn(leadService, "getLead").mockRejectedValueOnce(new Error("transient outage"));

    await advanceWorkflowRun(run);
    expect(run.status).toBe("waiting");
    expect(run.attempts).toBe(1);
    expect(run.lastError).toBe("transient outage");

    getLeadSpy.mockRestore();

    await advanceWorkflowRun(run);
    expect(run.status).toBe("completed");
    expect(run.attempts).toBe(0); // reset to 0 on advancing to the next step

    const lead = await leadService.getLead(leadId);
    expect(lead?.tags).toContain("recovered-tag");
  });

  it("an unknown workflowId fails the run immediately with a descriptive error", async () => {
    const run = await startWorkflowRun("no-such-workflow-definition", "Lead", "irrelevant", {});
    await advanceWorkflowRun(run);
    expect(run.status).toBe("failed");
    expect(run.lastError).toMatch(/unknown workflow/i);
  });

  it("a step with no retryPolicy fails permanently on its first failure (maxAttempts defaults to 1)", async () => {
    const definition = await defineWorkflow([{ id: "no-retry-step", action: { type: "add_tag", params: { tagId: "x" } } }]);
    const run = await startWorkflowRun(definition.id, "Lead", "no-such-lead-id", {});
    await advanceWorkflowRun(run);
    expect(run.status).toBe("failed");
    expect(run.attempts).toBe(1);
  });
});

describe("RC-3 — pentest: concurrent poller invocations never double-execute a workflow step", () => {
  it("repository.claim() is the real atomic gate: a second claim on the same id, after the first succeeded, returns null", async () => {
    const { getWorkflowRunRepository } = await import("@/lib/db");
    const repository = await getWorkflowRunRepository();
    const definition = await defineWorkflow([{ id: "step-1", action: { type: "add_tag", params: { tagId: "x" } } }]);
    const run = await startWorkflowRun(definition.id, "Lead", "irrelevant", {});

    const first = await repository.claim(run.id, new Date(0));
    expect(first).not.toBeNull();
    expect(first!.status).toBe("processing");

    const second = await repository.claim(run.id, new Date(0));
    expect(second).toBeNull();
  });

  it("simulates the real race: a second poller invocation attempting to claim the SAME run while it's still 'processing' (right up to the final persisted update) sees it as already taken, and the step's action fires exactly once", async () => {
    const leadId = await createLead();
    let raceResult: unknown = "not yet attempted";
    let executions = 0;

    const definition = await defineWorkflow([{ id: "racy-step", action: { type: "add_tag", params: { tagId: "raced-tag" } } }]);
    const run = await startWorkflowRun(definition.id, "Lead", leadId, {});

    const { getWorkflowRunRepository } = await import("@/lib/db");
    const repository = await getWorkflowRunRepository();
    const originalUpdate = repository.update.bind(repository);
    vi.spyOn(repository, "update").mockImplementation(async (id, patch) => {
      executions++;
      raceResult = await repository.claim(id, new Date(0));
      return originalUpdate(id, patch);
    });

    await advanceWorkflowRun(run);

    expect(executions).toBe(1);
    expect(raceResult).toBeNull();
    expect(run.status).toBe("completed");

    const lead = await leadService.getLead(leadId);
    expect(lead?.tags).toContain("raced-tag");
  });

  it("a run stuck in 'processing' past the stale-claim threshold is reclaimed (crash/restart recovery)", async () => {
    const { getWorkflowRunRepository } = await import("@/lib/db");
    const repository = await getWorkflowRunRepository();
    const definition = await defineWorkflow([{ id: "step-1", action: { type: "add_tag", params: { tagId: "x" } } }]);
    const run = await startWorkflowRun(definition.id, "Lead", "irrelevant", {});

    // Simulate a prior attempt that claimed this run and then crashed
    // before ever reaching a real terminal-for-this-tick update.
    await repository.claim(run.id, new Date(0));
    expect((await repository.findById(run.id))!.status).toBe("processing");

    // Immediately re-claiming with a REALISTIC staleness boundary (the
    // real STALE_CLAIM_MS window, same as a genuine caller would pass)
    // correctly refuses — this run's own claim isn't stale yet.
    const { STALE_CLAIM_MS: realStaleClaimMs } = await import("./types");
    expect(await repository.claim(run.id, new Date(Date.now() - realStaleClaimMs))).toBeNull();

    // But a staleBefore in the FUTURE (simulating enough real time
    // having passed) successfully reclaims the abandoned run.
    const farFuture = new Date(Date.now() + 60 * 60 * 1000);
    const reclaimed = await repository.claim(run.id, farFuture);
    expect(reclaimed).not.toBeNull();
    expect(reclaimed!.status).toBe("processing");
  });

  it("findDue() surfaces a stale 'processing' run alongside genuinely due pending/waiting ones", async () => {
    const { getWorkflowRunRepository } = await import("@/lib/db");
    const repository = await getWorkflowRunRepository();
    const definition = await defineWorkflow([{ id: "step-1", action: { type: "add_tag", params: { tagId: "x" } } }]);
    const run = await startWorkflowRun(definition.id, "Lead", "irrelevant", {});
    await repository.claim(run.id, new Date(0)); // now "processing", simulating an abandoned claim.

    // Immediately: not yet stale by the real STALE_CLAIM_MS threshold.
    const dueNow = await repository.findDue(new Date());
    expect(dueNow.some((r) => r.id === run.id)).toBe(false);

    // Far enough in the future that the real threshold has elapsed.
    const { STALE_CLAIM_MS } = await import("./types");
    const dueLater = await repository.findDue(new Date(Date.now() + STALE_CLAIM_MS + 1000));
    expect(dueLater.some((r) => r.id === run.id)).toBe(true);
  });
});

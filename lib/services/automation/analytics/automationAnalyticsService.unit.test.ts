import { describe, it, expect } from "vitest";
import { startWorkflowRun, advanceWorkflowRun } from "../engine";
import { createWorkflowDefinition } from "../definitions";
import { getWorkflowRunRepository, getMessageRepository, getTaskRepository } from "@/lib/db";
import { leadService } from "@/lib/services/leads";
import { getAutomationAnalytics } from "./automationAnalyticsService";
import type { DateRange } from "./types";
import type { PersistedWorkflowStep } from "../types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Automation Analytics
 * (mission §1). Drives the REAL engine (startWorkflowRun/
 * advanceWorkflowRun) against a real, persisted WorkflowDefinition —
 * the same "protect the actual registry wiring, not a parallel model of
 * it" approach engine.unit.test.ts already established — rather than
 * hand-constructing WorkflowRun fixtures that could silently drift from
 * what the engine actually produces.
 */

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function wideRange(): DateRange {
  return { from: new Date(Date.now() - 60_000).toISOString(), to: new Date(Date.now() + 60_000).toISOString() };
}

async function createLead(): Promise<string> {
  const suffix = uniqueId("lead");
  const result = await leadService.registerLead({
    name: "Automation Analytics Test Lead",
    email: `${suffix}@example.com`,
    phone: `+9198${String(Math.floor(Math.random() * 10_000_000)).padStart(8, "0")}`,
    source: "unit-test",
  });
  if (!result.success) throw new Error(`Failed to create lead: ${JSON.stringify(result.errors)}`);
  return result.lead.id;
}

async function defineWorkflow(steps: PersistedWorkflowStep[], triggerEventType = "unit-test-trigger") {
  const result = await createWorkflowDefinition({
    id: uniqueId("automation-analytics-wf"),
    name: "Automation Analytics unit test workflow",
    triggerEventType,
    active: true,
    steps,
  });
  if (!result.success) throw new Error(`Failed to create test workflow definition: ${JSON.stringify(result.errors)}`);
  return result.definition;
}

describe("getAutomationAnalytics", () => {
  it("a successful two-step run is counted as completed, with actionExecutionVolume equal to its full step count", async () => {
    const range = wideRange();
    const leadId = await createLead();
    const definition = await defineWorkflow([
      { id: "step-1", action: { type: "add_tag", params: { tagId: uniqueId("tag") } } },
      { id: "step-2", action: { type: "add_tag", params: { tagId: uniqueId("tag") } } },
    ]);

    const run = await startWorkflowRun(definition.id, "Lead", leadId, {});
    await advanceWorkflowRun(run); // step 1
    await advanceWorkflowRun(run); // step 2 -> completed

    expect(run.status).toBe("completed");
    const result = await getAutomationAnalytics(range);
    expect(result.runsByStatus.completed).toBeGreaterThanOrEqual(1);
    expect(result.actionExecutionVolume).toBeGreaterThanOrEqual(2); // both of THIS run's steps, at minimum
  });

  it("a run that exhausts retries counts as failed, retryRatePct reflects it, and deadLetterCount equals runsByStatus.failed", async () => {
    const range = wideRange();
    const definition = await defineWorkflow([
      { id: "always-fails", action: { type: "add_tag", params: { tagId: "irrelevant" } }, retryPolicy: { maxAttempts: 2, backoff: { amount: 1, unit: "minutes" } } },
    ]);

    const run = await startWorkflowRun(definition.id, "Lead", "no-such-lead-id", {});
    await advanceWorkflowRun(run); // attempt 1 -> waiting, attempts: 1
    await advanceWorkflowRun(run); // attempt 2 -> exhausted -> failed

    expect(run.status).toBe("failed");
    expect(run.attempts).toBe(2); // attempts >= maxAttempts (2) -> exhausted, matching engine.unit.test.ts's own assertion for this identical scenario

    const result = await getAutomationAnalytics(range);
    expect(result.runsByStatus.failed).toBeGreaterThanOrEqual(1);
    expect(result.deadLetterCount).toBe(result.runsByStatus.failed);
    expect(result.retryRatePct).not.toBeNull();
  });

  it("a run whose completionReason is 'converted' is counted toward automationGeneratedConversions", async () => {
    const range = wideRange();
    const leadId = await createLead();
    const definition = await defineWorkflow([{ id: "step-1", action: { type: "add_tag", params: { tagId: uniqueId("tag") } } }]);

    const run = await startWorkflowRun(definition.id, "Lead", leadId, {});
    // Simulates exactly what triggers.ts's own registration.created
    // subscriber does when it stops an active run early — see that
    // file's own handler. Not re-testing the event-bus wiring itself
    // (out of scope here), only that this module counts the resulting
    // state correctly.
    const repository = await getWorkflowRunRepository();
    await repository.update(run.id, { status: "completed", completionReason: "converted" });

    const result = await getAutomationAnalytics(range);
    expect(result.automationGeneratedConversions).toBeGreaterThanOrEqual(1);
  });

  it("automationGeneratedMessages/Tasks count only Message/Task rows carrying a workflowRunId, not every Message/Task in range", async () => {
    const range = wideRange();
    const before = await getAutomationAnalytics(range);

    const messageRepository = await getMessageRepository();
    const taskRepository = await getTaskRepository();
    await messageRepository.create({ recipientPhoneE164: "+919800000000", workflowRunId: uniqueId("run") });
    await messageRepository.create({ recipientPhoneE164: "+919800000001" }); // no workflowRunId — a manual/campaign send
    await taskRepository.create({ title: "Automation task", dueAt: new Date().toISOString(), assigneeId: "unit-test-assignee", workflowRunId: uniqueId("run") });
    await taskRepository.create({ title: "Manual task", dueAt: new Date().toISOString(), assigneeId: "unit-test-assignee" });

    const after = await getAutomationAnalytics(range);
    expect(after.automationGeneratedMessages - before.automationGeneratedMessages).toBe(1);
    expect(after.automationGeneratedTasks - before.automationGeneratedTasks).toBe(1);
  });

  it("successRatePct/failureRatePct are null when no run in range has reached a terminal state yet", async () => {
    const emptyFutureRange: DateRange = {
      from: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      to: new Date(Date.now() + 11 * 86_400_000).toISOString(),
    };
    const result = await getAutomationAnalytics(emptyFutureRange);
    expect(result.successRatePct).toBeNull();
    expect(result.failureRatePct).toBeNull();
    expect(result.executions).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { startWorkflowRun, advanceWorkflowRun } from "../engine";
import { createWorkflowDefinition } from "../definitions";
import { getWorkflowRunRepository, getPaymentRepository } from "@/lib/db";
import { leadService } from "@/lib/services/leads";
import { getWorkflowPerformance } from "./workflowPerformanceService";
import type { DateRange } from "./types";
import type { PersistedWorkflowStep } from "../types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Workflow Performance
 * (mission §2) and Revenue Attribution (mission §4)'s DIRECT-vs-
 * INFLUENCED split, exercised at the per-workflow level. The core claim
 * under test: revenueInfluencedInr is correlation (any payment after
 * the run started, for any lead the run touched), revenueAttributedInr
 * is the stricter "converted" signal — never the other way around.
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
    name: "Workflow Performance Test Lead",
    email: `${suffix}@example.com`,
    phone: `+9198${String(Math.floor(Math.random() * 10_000_000)).padStart(8, "0")}`,
    source: "unit-test",
  });
  if (!result.success) throw new Error(`Failed to create lead: ${JSON.stringify(result.errors)}`);
  return result.lead.id;
}

async function defineWorkflow(steps: PersistedWorkflowStep[]) {
  const result = await createWorkflowDefinition({
    id: uniqueId("workflow-performance-wf"),
    name: "Workflow Performance unit test workflow",
    triggerEventType: "unit-test-trigger",
    active: true,
    steps,
  });
  if (!result.success) throw new Error(`Failed to create test workflow definition: ${JSON.stringify(result.errors)}`);
  return result.definition;
}

async function seedSucceededPaymentForLead(leadId: string) {
  const repository = await getPaymentRepository();
  const payment = await repository.create({
    provider: "razorpay",
    providerOrderId: uniqueId("order"),
    amountInSmallestUnit: 500000, // ₹5000
    currency: "INR",
    status: "created",
    purpose: "Workflow performance unit test",
    leadId,
  });
  return repository.update(payment.id, { status: "succeeded" });
}

describe("getWorkflowPerformance", () => {
  it("a normally-completed run whose lead paid afterward counts as INFLUENCED revenue, not DIRECT/attributed", async () => {
    const range = wideRange();
    const leadId = await createLead();
    const definition = await defineWorkflow([{ id: "step-1", action: { type: "add_tag", params: { tagId: uniqueId("tag") } } }]);

    const run = await startWorkflowRun(definition.id, "Lead", leadId, {});
    await advanceWorkflowRun(run); // completes normally — sequence_finished, NOT converted
    await seedSucceededPaymentForLead(leadId); // pays afterward

    const result = await getWorkflowPerformance(range);
    const entry = result.workflows.find((w) => w.workflowId === definition.id);
    expect(entry).toBeDefined();
    expect(entry!.revenueInfluencedInr).toBeGreaterThanOrEqual(5000);
    expect(entry!.revenueAttributedInr).toBe(0); // no "converted" signal — never presented as direct
  });

  it("a run stopped by its own lead's conversion (completionReason: converted) counts toward BOTH influenced and attributed revenue", async () => {
    const range = wideRange();
    const leadId = await createLead();
    const definition = await defineWorkflow([{ id: "step-1", action: { type: "add_tag", params: { tagId: uniqueId("tag") } } }]);

    const run = await startWorkflowRun(definition.id, "Lead", leadId, {});
    const repository = await getWorkflowRunRepository();
    await repository.update(run.id, { status: "completed", completionReason: "converted" }); // simulates triggers.ts's own cross-workflow stop
    await seedSucceededPaymentForLead(leadId);

    const result = await getWorkflowPerformance(range);
    const entry = result.workflows.find((w) => w.workflowId === definition.id);
    expect(entry).toBeDefined();
    expect(entry!.conversions).toBe(1);
    expect(entry!.revenueInfluencedInr).toBeGreaterThanOrEqual(5000);
    expect(entry!.revenueAttributedInr).toBeGreaterThanOrEqual(5000);
  });

  it("a payment made BEFORE the run started is never counted as influenced or attributed for that run", async () => {
    const range = wideRange();
    const leadId = await createLead();
    await seedSucceededPaymentForLead(leadId); // pays first
    // The "influenced" join is `payment.createdAt >= run.createdAt`
    // (inclusive, by design — a same-instant payment/run-start is a
    // real, deliberate edge case, not a bug). A real delay here is what
    // actually makes THIS test's premise ("before") unambiguous at
    // millisecond precision — without it, an in-memory round-trip fast
    // enough to land both timestamps in the same millisecond would
    // make a genuinely-before payment indistinguishable from
    // genuinely-at-the-same-instant.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const definition = await defineWorkflow([{ id: "step-1", action: { type: "add_tag", params: { tagId: uniqueId("tag") } } }]);
    const run = await startWorkflowRun(definition.id, "Lead", leadId, {}); // workflow starts AFTER the payment
    await advanceWorkflowRun(run);

    const result = await getWorkflowPerformance(range);
    const entry = result.workflows.find((w) => w.workflowId === definition.id);
    expect(entry).toBeDefined();
    expect(entry!.revenueInfluencedInr).toBe(0); // the payment predates this run — not influenced by it
  });

  it("lastExecutionAt reflects the workflow's own most recent run, unscoped by the analytics date range", async () => {
    const leadId = await createLead();
    const definition = await defineWorkflow([{ id: "step-1", action: { type: "add_tag", params: { tagId: uniqueId("tag") } } }]);
    const run = await startWorkflowRun(definition.id, "Lead", leadId, {});
    await advanceWorkflowRun(run);

    // A far-future range with zero runs inside it — lastExecutionAt
    // should still resolve, since it's deliberately NOT range-scoped.
    const farFutureRange: DateRange = {
      from: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      to: new Date(Date.now() + 11 * 86_400_000).toISOString(),
    };
    const result = await getWorkflowPerformance(farFutureRange);
    const entry = result.workflows.find((w) => w.workflowId === definition.id);
    expect(entry).toBeDefined();
    expect(entry!.runs).toBe(0); // no runs IN this range
    expect(entry!.lastExecutionAt).not.toBeNull(); // but it has run before, and that's still surfaced
  });
});

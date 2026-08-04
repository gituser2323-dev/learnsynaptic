import { getWorkflowRunRepository, getMessageRepository, getTaskRepository, getPaymentRepository } from "@/lib/db";
import { listWorkflowCatalog } from "../definitions";
import type { WorkflowRun } from "../types";
import type { DateRange, WorkflowPerformanceEntry, WorkflowPerformanceResult } from "./types";

/** See automationAnalyticsService.ts's own doc comment on this same
 *  cap/reduce-in-memory tradeoff. This fetch is deliberately UNSCOPED by
 *  date (sorted newest-first) so lastExecutionAt reflects the true most
 *  recent run per workflow, not just the most recent one inside the
 *  selected range — the tradeoff is that a workflow whose last run
 *  falls outside this cap's window shows lastExecutionAt: null even
 *  though it has run further in the past. Disclosed, not silently
 *  wrong. */
const MAX_RUNS_FOR_ANALYTICS = 5000;
const MAX_PAYMENTS_FOR_ANALYTICS = 5000;

function hoursBetween(earlierIso: string, laterIso: string): number {
  return (new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / 3_600_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function inRange(iso: string, range: DateRange): boolean {
  return iso >= range.from && iso <= range.to;
}

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Workflow Performance
 * (mission §2): per-WorkflowDefinition breakdown. `runs` in this file
 * always means runs whose createdAt falls in `range`; lastExecutionAt is
 * the one deliberate exception (see module doc above).
 *
 * revenueInfluencedInr / revenueAttributedInr distinguish INFLUENCED
 * from DIRECT attribution (mission §4): influenced is "this workflow
 * ran against this lead, and a succeeded payment for that lead followed
 * — correlation, not proof of causation." Attributed is stricter —
 * scoped only to runs whose completionReason is "converted" (the
 * workflow was demonstrably still active when this lead's own
 * registration/conversion event stopped it), still ultimately a
 * leadId join rather than a first-class "this payment came from this
 * workflow" record, so even "attributed" here is best-effort, not a
 * guarantee.
 */
export async function getWorkflowPerformance(range: DateRange): Promise<WorkflowPerformanceResult> {
  const [definitions, allRunsPage, messagesPage, tasksPage, paymentsPage] = await Promise.all([
    listWorkflowCatalog(),
    (await getWorkflowRunRepository()).list({}, 1, MAX_RUNS_FOR_ANALYTICS),
    (await getMessageRepository()).list({ hasWorkflowRunId: true, createdAfter: range.from, createdBefore: range.to }, 1, MAX_RUNS_FOR_ANALYTICS),
    (await getTaskRepository()).list({ hasWorkflowRunId: true, createdAfter: range.from, createdBefore: range.to }, 1, MAX_RUNS_FOR_ANALYTICS),
    (await getPaymentRepository()).list({ status: "succeeded" }, 1, MAX_PAYMENTS_FOR_ANALYTICS),
  ]);

  const allRuns = allRunsPage.items; // sorted createdAt desc by the repository.
  const runsInRange = allRuns.filter((r) => inRange(r.createdAt, range));

  // Message/Task counts per WorkflowRun id.
  const messageCountByRunId = new Map<string, number>();
  for (const m of messagesPage.items) {
    if (!m.workflowRunId) continue;
    messageCountByRunId.set(m.workflowRunId, (messageCountByRunId.get(m.workflowRunId) ?? 0) + 1);
  }
  const taskCountByRunId = new Map<string, number>();
  for (const t of tasksPage.items) {
    if (!t.workflowRunId) continue;
    taskCountByRunId.set(t.workflowRunId, (taskCountByRunId.get(t.workflowRunId) ?? 0) + 1);
  }

  // Succeeded-payment total (INR) and earliest-succeeded-at per leadId.
  const paymentInrByLeadId = new Map<string, { totalInr: number; entries: { amountInr: number; at: string }[] }>();
  for (const p of paymentsPage.items) {
    if (!p.leadId || p.currency !== "INR") continue; // cross-currency revenue can't be summed into one INR figure — see revenueAnalytics's own doc.
    const amountInr = p.amountInSmallestUnit / 100;
    const entry = paymentInrByLeadId.get(p.leadId) ?? { totalInr: 0, entries: [] };
    entry.totalInr += amountInr;
    entry.entries.push({ amountInr, at: p.createdAt });
    paymentInrByLeadId.set(p.leadId, entry);
  }

  // lastExecutionAt per workflowId, from the full (unscoped) run set —
  // allRuns is already createdAt-desc, so the first match per workflowId wins.
  const lastExecutionByWorkflowId = new Map<string, string>();
  for (const run of allRuns) {
    if (!lastExecutionByWorkflowId.has(run.workflowId)) lastExecutionByWorkflowId.set(run.workflowId, run.createdAt);
  }

  const runsByWorkflowId = new Map<string, WorkflowRun[]>();
  for (const run of runsInRange) {
    const bucket = runsByWorkflowId.get(run.workflowId) ?? [];
    bucket.push(run);
    runsByWorkflowId.set(run.workflowId, bucket);
  }

  const workflows: WorkflowPerformanceEntry[] = definitions.map((definition) => {
    const runs = runsByWorkflowId.get(definition.id) ?? [];
    const successes = runs.filter((r) => r.status === "completed").length;
    const failures = runs.filter((r) => r.status === "failed").length;
    const conversions = runs.filter((r) => r.completionReason === "converted").length;
    const entitiesAffected = new Set(runs.map((r) => r.entityId)).size;

    let messagesSent = 0;
    let tasksCreated = 0;
    let revenueInfluencedInr = 0;
    let revenueAttributedInr = 0;
    const seenLeadIdsForInfluence = new Set<string>();
    const seenLeadIdsForAttribution = new Set<string>();

    for (const run of runs) {
      messagesSent += messageCountByRunId.get(run.id) ?? 0;
      tasksCreated += taskCountByRunId.get(run.id) ?? 0;

      if (run.entityType !== "Lead") continue;
      const payments = paymentInrByLeadId.get(run.entityId);
      if (!payments) continue;

      // A payment "influenced" by this run: happened on/after the run
      // started, for a lead this run actually ran against. Counted once
      // per lead per workflow (not once per run) — a lead with two runs
      // of the same workflow shouldn't double-count the same revenue.
      if (!seenLeadIdsForInfluence.has(run.entityId)) {
        const influenced = payments.entries.filter((e) => e.at >= run.createdAt);
        if (influenced.length > 0) {
          revenueInfluencedInr += influenced.reduce((sum, e) => sum + e.amountInr, 0);
          seenLeadIdsForInfluence.add(run.entityId);
        }
      }

      if (run.completionReason === "converted" && !seenLeadIdsForAttribution.has(run.entityId)) {
        const attributed = payments.entries.filter((e) => e.at >= run.createdAt);
        if (attributed.length > 0) {
          revenueAttributedInr += attributed.reduce((sum, e) => sum + e.amountInr, 0);
          seenLeadIdsForAttribution.add(run.entityId);
        }
      }
    }

    const terminalHours = runs.filter((r) => r.status === "completed" || r.status === "failed").map((r) => hoursBetween(r.createdAt, r.updatedAt));
    const terminalCount = successes + failures;

    return {
      workflowId: definition.id,
      workflowName: definition.name,
      active: definition.active,
      triggerEventType: definition.triggerEventType,
      runs: runs.length,
      successes,
      failures,
      conversions,
      entitiesAffected,
      messagesSent,
      tasksCreated,
      revenueInfluencedInr,
      revenueAttributedInr,
      avgCompletionTimeHours: average(terminalHours),
      lastExecutionAt: lastExecutionByWorkflowId.get(definition.id) ?? null,
      errorRatePct: terminalCount === 0 ? null : (failures / terminalCount) * 100,
    };
  });

  return { range, workflows };
}

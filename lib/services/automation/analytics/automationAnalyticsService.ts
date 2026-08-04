import { getWorkflowRunRepository, getMessageRepository, getTaskRepository } from "@/lib/db";
import { listWorkflowCatalog } from "../definitions";
import type { WorkflowDefinitionRecord, WorkflowRun } from "../types";
import type {
  AutomationAnalyticsSummary,
  AutomationRunStatusBreakdown,
  AutomationTrendPoint,
  DateRange,
} from "./types";

/** Dashboard-scale read, not a real aggregation pipeline — the same
 *  "fetch a reasonable cap, reduce in memory" judgment call
 *  campaignMetrics.ts's own MAX_CAMPAIGNS_FOR_OVERALL_METRICS already
 *  makes for the identical reason. Worth upgrading to a real Mongo
 *  aggregation once WorkflowRun volume genuinely exceeds this in a
 *  production account — see the Implementation Audit's own Performance
 *  Considerations note for this module. */
const MAX_RUNS_FOR_ANALYTICS = 5000;
/** A trend chart with more than this many day-buckets stops being
 *  readable — the same judgment call every chart in this dashboard
 *  already makes about how much it renders. */
const MAX_TREND_DAYS = 92;

function hoursBetween(earlierIso: string, laterIso: string): number {
  return (new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / 3_600_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function isTerminal(run: WorkflowRun): boolean {
  return run.status === "completed" || run.status === "failed";
}

/** See types.ts's own module doc, point 2 — a real, derived (not
 *  logged) count of how many steps this run has successfully executed. */
function actionsExecutedFor(run: WorkflowRun, definition: WorkflowDefinitionRecord | undefined): number {
  if (!definition) return run.currentStepIndex; // definition deleted since — best-effort from the run's own index.
  if (run.status === "completed" && run.completionReason === "sequence_finished") return definition.steps.length;
  return run.currentStepIndex;
}

function dayBucket(iso: string): string {
  return iso.slice(0, 10);
}

function buildTrend(runs: WorkflowRun[], range: DateRange): AutomationTrendPoint[] {
  // Compares calendar-day prefixes, not raw millisecond deltas — `to`
  // carries an end-of-day time component (see dateRanges.ts), so a
  // millisecond-based span would over-count by a fractional day.
  const fromDayMs = Date.parse(`${dayBucket(range.from)}T00:00:00.000Z`);
  const toDayMs = Date.parse(`${dayBucket(range.to)}T00:00:00.000Z`);
  const spanDays = Math.round((toDayMs - fromDayMs) / 86_400_000) + 1;
  if (spanDays > MAX_TREND_DAYS || spanDays < 1) return [];

  const byDay = new Map<string, AutomationTrendPoint>();
  for (let i = 0; i < spanDays; i++) {
    const date = new Date(fromDayMs + i * 86_400_000).toISOString().slice(0, 10);
    byDay.set(date, { date, executions: 0, completed: 0, failed: 0 });
  }
  for (const run of runs) {
    const point = byDay.get(dayBucket(run.createdAt));
    if (!point) continue; // outside the bucketed span (shouldn't happen — runs are already range-filtered).
    point.executions++;
    if (run.status === "completed") point.completed++;
    if (run.status === "failed") point.failed++;
  }
  return [...byDay.values()];
}

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Automation Analytics
 * (mission §1): the account-wide rollup across every WorkflowRun that
 * started within `range`. See ./types.ts's own module doc for the two
 * disclosed derivation limits (retry rate, action-execution volume).
 */
export async function getAutomationAnalytics(range: DateRange): Promise<AutomationAnalyticsSummary> {
  const [definitions, runsPage, messagesInRange, tasksInRange] = await Promise.all([
    listWorkflowCatalog(),
    (await getWorkflowRunRepository()).list({ createdAfter: range.from, createdBefore: range.to }, 1, MAX_RUNS_FOR_ANALYTICS),
    (await getMessageRepository()).list({ hasWorkflowRunId: true, createdAfter: range.from, createdBefore: range.to }, 1, 1),
    (await getTaskRepository()).list({ hasWorkflowRunId: true, createdAfter: range.from, createdBefore: range.to }, 1, 1),
  ]);

  const runs = runsPage.items;
  const definitionById = new Map(definitions.map((d) => [d.id, d]));

  const runsByStatus: AutomationRunStatusBreakdown = { pending: 0, waiting: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
  const triggerFrequency: Record<string, number> = {};
  let actionExecutionVolume = 0;
  let conversions = 0;
  const terminalCompletionHours: number[] = [];
  const retryFlags: boolean[] = []; // one entry per terminal run: did its last step need a retry?

  for (const run of runs) {
    runsByStatus[run.status]++;

    const definition = definitionById.get(run.workflowId);
    const triggerType = definition?.triggerEventType ?? "unknown";
    triggerFrequency[triggerType] = (triggerFrequency[triggerType] ?? 0) + 1;

    actionExecutionVolume += actionsExecutedFor(run, definition);
    if (run.completionReason === "converted") conversions++;

    if (isTerminal(run)) {
      terminalCompletionHours.push(hoursBetween(run.createdAt, run.updatedAt));
      retryFlags.push(run.attempts > 0);
    }
  }

  const terminalCount = runsByStatus.completed + runsByStatus.failed;
  const successRatePct = terminalCount === 0 ? null : (runsByStatus.completed / terminalCount) * 100;
  const failureRatePct = terminalCount === 0 ? null : (runsByStatus.failed / terminalCount) * 100;
  const retryRatePct = retryFlags.length === 0 ? null : (retryFlags.filter(Boolean).length / retryFlags.length) * 100;

  return {
    range,
    executions: runs.length,
    activeWorkflowDefinitions: definitions.filter((d) => d.active).length,
    totalWorkflowDefinitions: definitions.length,
    runsByStatus,
    successRatePct,
    failureRatePct,
    retryRatePct,
    deadLetterCount: runsByStatus.failed,
    avgCompletionTimeHours: average(terminalCompletionHours),
    triggerFrequency,
    actionExecutionVolume,
    automationGeneratedMessages: messagesInRange.total,
    automationGeneratedTasks: tasksInRange.total,
    automationGeneratedConversions: conversions,
    trend: buildTrend(runs, range),
  };
}

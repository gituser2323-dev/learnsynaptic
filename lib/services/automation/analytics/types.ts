import type { DateRange } from "@/lib/services/marketing";

export type { DateRange };

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Automation Analytics
 * domain layer.
 *
 * Every figure here is derived on read from WorkflowRun (the only
 * persisted execution record — see lib/services/automation/types.ts's
 * own doc comment on WorkflowRun vs. WorkflowDefinition) plus the
 * Message/Task rows a run's own action executors stamp with
 * `workflowRunId` (see Message.workflowRunId's doc comment). Nothing
 * here is a second automation event log — the event bus itself is
 * fire-and-forget, never persisted, so WorkflowRun's own status/
 * timestamps/attempts fields are the only real source of truth.
 *
 * Two disclosed, structural limitations worth reading before trusting
 * these numbers at face value:
 *
 *  1. **Retry rate undercounts.** WorkflowRun.attempts is a per-STEP
 *     counter, reset to 0 every time a run advances to its next step
 *     (see engine.ts's moveToNextStep). A run that retried twice on
 *     step 1, succeeded, then retried once on step 3 before finishing
 *     only ever shows `attempts: 1` at completion — the step-1 retries
 *     are real but not recoverable from the persisted row. retryRate
 *     here is "share of terminal runs whose LAST step needed at least
 *     one retry," not "total retries across every run's full history."
 *
 *  2. **actionsExecuted is derived, not logged.** No table records
 *     "action X ran for run Y at time Z." It's inferred from
 *     currentStepIndex against the definition's own step count: a
 *     "completed/sequence_finished" run ran every step; a "converted"
 *     run ran exactly currentStepIndex steps (moveToNextStep only
 *     increments AFTER a step succeeds); a "failed" run ran
 *     currentStepIndex steps successfully before the step that
 *     ultimately failed. This is a real, derivable count — not a
 *     fabricated one — but it undercounts a step that was attempted
 *     and failed without ever showing up as "executed."
 */

export interface AutomationRunStatusBreakdown {
  pending: number;
  waiting: number;
  /** RC-3 — the atomic-claim transient state (see WorkflowRunStatus's
   *  own doc comment). Expected to be ~0 in a normal analytics read —
   *  a non-zero count that PERSISTS across repeated reads is the real
   *  signal worth an operator's attention: a run stuck mid-claim
   *  (see STALE_CLAIM_MS) longer than a single poll cycle. */
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface AutomationTrendPoint {
  /** YYYY-MM-DD, UTC day bucket — the same plain-date-string convention
   *  DateRange.from/to already use. */
  date: string;
  executions: number;
  completed: number;
  failed: number;
}

export interface AutomationAnalyticsSummary {
  range: DateRange;
  /** Total WorkflowRun rows created in range — "how many times did any
   *  workflow start." */
  executions: number;
  /** WorkflowDefinition catalog state (active: true) — NOT date-scoped,
   *  a snapshot of what's currently live, distinct from
   *  runsByStatus below (which IS date-scoped run history). */
  activeWorkflowDefinitions: number;
  totalWorkflowDefinitions: number;
  runsByStatus: AutomationRunStatusBreakdown;
  /** completed / (completed + failed), 0–100. Null if no run in range
   *  has reached a terminal state yet. */
  successRatePct: number | null;
  failureRatePct: number | null;
  /** See this file's own module doc, point 1. Null if no run in range
   *  is terminal yet. */
  retryRatePct: number | null;
  /** This app's automation engine has no separate "dead letter" state
   *  — every "failed" WorkflowRun already means either the step's own
   *  retryPolicy was exhausted or the workflow could never be resolved
   *  (see engine.ts's advanceWorkflowRun), which is exactly what a
   *  dead-letter queue represents elsewhere in this app (compare
   *  Module 6.5's WebhookDeliveryAttempt "dead_letter" outcome). So
   *  this is an alias for runsByStatus.failed, not a second counter. */
  deadLetterCount: number;
  /** Hours between createdAt and updatedAt for terminal (completed or
   *  failed) runs in range — real wall-clock time, which legitimately
   *  includes any step's own intentional delay (a 3-day nurture step
   *  makes this 3+ days for that run, correctly, not a bug). Null if no
   *  run in range is terminal yet. */
  avgCompletionTimeHours: number | null;
  /** Runs grouped by the triggering event type (via each run's
   *  WorkflowDefinition.triggerEventType) — "what's actually firing
   *  these workflows." A run whose definition was deleted since it
   *  started is grouped under "unknown". */
  triggerFrequency: Record<string, number>;
  /** Sum of actionsExecuted (see module doc, point 2) across every run
   *  in range. */
  actionExecutionVolume: number;
  /** Message rows with a workflowRunId belonging to a run in range. */
  automationGeneratedMessages: number;
  /** Task rows with a workflowRunId belonging to a run in range. */
  automationGeneratedTasks: number;
  /** Runs in range whose completionReason is "converted" — the
   *  triggers.ts registration.created cross-workflow stop, the one
   *  real, already-existing "this lead converted while the workflow was
   *  still active" signal in the schema. */
  automationGeneratedConversions: number;
  /** Day-bucketed executions/completed/failed within range — omitted
   *  (empty array) if the range spans more than 92 days, the same
   *  "don't render an unreadable chart" judgment call FunnelViz's own
   *  callers already make elsewhere. */
  trend: AutomationTrendPoint[];
}

export interface WorkflowPerformanceEntry {
  workflowId: string;
  workflowName: string;
  active: boolean;
  triggerEventType: string;
  runs: number;
  successes: number;
  failures: number;
  /** completionReason === "converted" runs — see
   *  AutomationAnalyticsSummary.automationGeneratedConversions' own doc. */
  conversions: number;
  /** Distinct entityId among this workflow's runs in range. Every
   *  current WorkflowDefinition targets entityType "Lead" (see
   *  triggers.ts), so this is effectively "leads affected," but the
   *  field counts distinct entities generically rather than assuming
   *  that never changes. */
  entitiesAffected: number;
  messagesSent: number;
  tasksCreated: number;
  /** Succeeded-Payment revenue (INR) for leads this workflow ran
   *  against, where the payment happened on/after the run started —
   *  correlation, not proof this workflow caused the payment. See
   *  revenueInfluenced vs. revenueAttributedInr's own distinction in
   *  lib/services/revenueAnalytics's module doc. */
  revenueInfluencedInr: number;
  /** Stricter: succeeded-Payment revenue attributed only to runs that
   *  completionReason "converted" — the workflow was demonstrably still
   *  active when this exact lead's own registration/conversion event
   *  stopped it, and a payment for that lead followed. Still a
   *  best-effort join (payment.leadId), not a first-class "this
   *  payment resulted from this workflow" record — disclosed as
   *  DIRECT-but-inferred, not a guaranteed causal link. */
  revenueAttributedInr: number;
  /** Hours, terminal runs only. Null if none. */
  avgCompletionTimeHours: number | null;
  /** ISO — most recent run's createdAt, unscoped by the analytics date
   *  range (answers "when did this last run," not "did it run within
   *  the selected window"). Null if this workflow has never run. */
  lastExecutionAt: string | null;
  /** failures / (successes + failures), 0–100. Null if none terminal. */
  errorRatePct: number | null;
}

export interface WorkflowPerformanceResult {
  range: DateRange;
  workflows: WorkflowPerformanceEntry[];
}

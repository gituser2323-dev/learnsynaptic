/**
 * Automation engine domain layer.
 *
 * Two distinct kinds of "workflow" here, deliberately:
 *  - WorkflowDefinition/WorkflowStep: CODE, defined in workflows/*.ts,
 *    deployed with the app. No admin UI exists to justify a data-driven
 *    (DB-editable) workflow DSL — that's real added complexity this
 *    module doesn't need yet.
 *  - WorkflowRun: DATA, persisted (lib/db/models/workflowRun.model.ts) —
 *    one running instance of a definition, tracking a specific entity's
 *    (e.g. a Lead's) progress through it. Has to be persisted, not held
 *    in memory: a multi-day delay between steps cannot survive a
 *    serverless function instance being torn down between invocations.
 */

import type { PaginatedResult } from "@/lib/pagination";

/** RC-3 — "processing" is new: the same atomic-claim transient state
 *  ScheduledJobStatus's own doc comment explains (lib/services/
 *  scheduler/types.ts) — a run's real terminal-for-this-tick status
 *  (waiting/completed/failed) is set immediately after
 *  `step.execute()` returns, so "processing" is only ever visible
 *  between a successful `claim()` and that update. A run stuck in
 *  "processing" (the process crashed/timed out mid-step, between claim
 *  and the follow-up update) is reclaimed automatically once its own
 *  claim goes stale — see `findDue()`'s own doc comment. */
export type WorkflowRunStatus = "pending" | "waiting" | "processing" | "completed" | "failed" | "cancelled";

/** RC-3 — how long a run may sit in "processing" before a subsequent
 *  poll treats its claim as abandoned (the process that claimed it
 *  crashed, timed out, or was killed mid-step) and reclaims it. Well
 *  above any realistic single-step execution time (a WhatsApp send, a
 *  task creation) and well above a serverless function's own hard
 *  execution ceiling, so a run that's GENUINELY still being processed
 *  is never reclaimed out from under a live attempt. */
export const STALE_CLAIM_MS = 10 * 60 * 1000;

export interface WorkflowRun {
  id: string;
  workflowId: string;
  entityType: string;
  entityId: string;
  /** The triggering event's payload, carried forward for every step's
   *  WorkflowContext.data. */
  context: Record<string, unknown>;
  currentStepIndex: number;
  status: WorkflowRunStatus;
  /** ISO — when the engine should next attempt to advance this run.
   *  "Now" for a run whose current step has no delay; the future for a
   *  run waiting out a step's delay or a failed step's retry backoff. */
  nextRunAt: string;
  /** Retry counter for the CURRENT step only — reset to 0 whenever the
   *  run advances to a new step. */
  attempts: number;
  lastError?: string;
  /** Set when status becomes "completed" — "sequence_finished" (ran out
   *  of steps) or "converted" (stopped early by a cross-workflow event,
   *  see triggers.ts). */
  completionReason?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowRunInput {
  workflowId: string;
  entityType: string;
  entityId: string;
  context: Record<string, unknown>;
}

/** Admin Dashboard — Automation page filters. */
export interface WorkflowRunListFilters {
  status?: WorkflowRunStatus;
  workflowId?: string;
  entityType?: string;
  entityId?: string;
  /** Enterprise Analytics (Phase 7), module 7.2 — inclusive ISO bounds
   *  against createdAt, the same createdAfter/createdBefore convention
   *  leadService/paymentService already use. */
  createdAfter?: string;
  createdBefore?: string;
}

export interface WorkflowRunRepository {
  create(input: CreateWorkflowRunInput): Promise<WorkflowRun>;
  /** The poller's query — runs ready to advance right now: "pending"/
   *  "waiting" runs whose nextRunAt has passed, PLUS (RC-3) any run
   *  stuck in "processing" longer than STALE_CLAIM_MS (engine.ts) — a
   *  real crash/timeout recovery path, not just the happy path. Callers
   *  MUST still call `claim()` before treating a candidate as theirs —
   *  this is read-only selection, same as ScheduledJobRepository's own
   *  findDue(). */
  findDue(now: Date): Promise<WorkflowRun[]>;
  /** RC-3 — atomically transitions a run to "processing" only if it's
   *  currently "pending"/"waiting", OR already "processing" but stale
   *  (its own updatedAt older than staleBefore — a crashed prior
   *  attempt's abandoned claim). Returns null if a concurrent poller
   *  invocation already holds a live claim on it. See
   *  ScheduledJobRepository.claim()'s own doc comment for the full
   *  double-execution-race reasoning this mirrors. */
  claim(id: string, staleBefore: Date): Promise<WorkflowRun | null>;
  findById(id: string): Promise<WorkflowRun | null>;
  /** Used to stop a lead's in-flight workflows early on conversion. */
  findActiveByEntity(entityType: string, entityId: string): Promise<WorkflowRun[]>;
  update(
    id: string,
    patch: Partial<
      Pick<WorkflowRun, "currentStepIndex" | "status" | "nextRunAt" | "attempts" | "lastError" | "completionReason">
    >,
  ): Promise<WorkflowRun>;
  /** Admin Dashboard — Automation page: filtered/paginated run history. */
  list(filters: WorkflowRunListFilters, page: number, limit: number): Promise<PaginatedResult<WorkflowRun>>;
}

export interface WorkflowContext {
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  /** Enterprise Analytics (Phase 7), module 7.2 — the WorkflowRun this
   *  step is executing for. Lets an action executor stamp a real,
   *  queryable link (see Message.workflowRunId / Task.workflowRunId)
   *  onto anything it creates, so "automation-generated messages/tasks"
   *  is an honest join rather than guessed from the absence of a
   *  campaignId. */
  runId: string;
}

export interface WorkflowStepDelay {
  amount: number;
  unit: "minutes" | "hours" | "days";
}

export interface RetryPolicy {
  maxAttempts: number;
  /** Backoff grows linearly with attempt number (backoff.amount × attempt) —
   *  simple and predictable for delays that span real wall-clock time
   *  between persisted attempts, unlike lib/services/whatsapp/retry.ts's
   *  exponential backoff, which is for an immediate in-process loop. */
  backoff: WorkflowStepDelay;
}

export interface WorkflowStepCondition {
  /** Human-readable reason, surfaced in logs when a step is skipped. */
  description: string;
  /** Evaluated before running the step. False means "skip this step
   *  entirely" — not a failure, not retried — and the run proceeds to
   *  whatever comes after it. */
  evaluate: (context: WorkflowContext) => Promise<boolean>;
}

export interface WorkflowStep {
  /** Stable within the workflow, e.g. "welcome-message". */
  id: string;
  /** Delay BEFORE this step runs, relative to the previous step
   *  completing (or workflow start, for the first step). Omitted means
   *  "run as soon as the previous step finishes." */
  delay?: WorkflowStepDelay;
  condition?: WorkflowStepCondition;
  execute: (context: WorkflowContext) => Promise<void>;
  /** Omitted means "run once, fail immediately on error" — a step this
   *  matters-less-if-it-fails-later doesn't need retries. */
  retryPolicy?: RetryPolicy;
}

export interface WorkflowDefinition {
  /** Stable id — WorkflowRun.workflowId references this. */
  id: string;
  name: string;
  /** The lib/events event type that starts a new run of this workflow. */
  triggerEventType: string;
  steps: WorkflowStep[];
}

/**
 * Business OS Phase 3, Module 3.1 — Persisted Workflow Definitions.
 *
 * A WorkflowDefinition (above) is CODE: an id/steps shape with live
 * execute()/evaluate() closures, exactly what engine.ts needs to run a
 * step. A WorkflowDefinitionRecord is DATA: the same definition
 * persisted in Mongo/in-memory, admin-editable without a redeploy. Every
 * step's condition/action is a {type, params} spec rather than a
 * closure — closures can't survive a database round-trip — resolved
 * against the action/condition registries (./actions, ./conditions) by
 * hydrateWorkflowDefinition() in ./definitions.ts, which turns a record
 * back into the exact runtime WorkflowDefinition shape engine.ts already
 * knows how to run. engine.ts and triggers.ts change to load definitions
 * from the repository instead of a static array; nothing about how a
 * run actually advances changes.
 *
 * One id, not two: `id` is both the record's stable identifier
 * (WorkflowRun.workflowId, triggers.ts's lookup key) AND what admin CRUD
 * routes address — the Mongo document's own `_id` is this same string
 * (see lib/db/models/workflowDefinition.model.ts), not a separate
 * ObjectId. Caller-supplied on create (e.g. "lead-nurture-sequence",
 * preserving the migrated definition's exact identity so existing
 * WorkflowRun rows keep resolving), immutable afterward.
 */
export type WorkflowActionType =
  | "send_whatsapp_template"
  | "assign_lead"
  | "add_tag"
  | "create_task"
  | "send_email"
  /** AI CRM (Phase 5), Module 5.1 — no params; analyzes the Lead entity
   *  this step is running against. See
   *  lib/services/automation/actions/executors/analyzeLeadAi.ts. */
  | "analyze_lead_ai"
  /** AI CRM (Phase 5), Module 5.3 — no params; analyzes the Lead's own
   *  most-recently-active Conversation, if any. See
   *  lib/services/automation/actions/executors/analyzeConversationAi.ts. */
  | "analyze_conversation_ai"
  /** Calendar & Meeting Connectors (Phase 6), Module 6.3 — the one
   *  workflow-trigger extension point the module's own mission calls
   *  for ("Workflow triggers," "Follow-up automation"): a workflow step
   *  can schedule a real meeting against the Lead it's running for.
   *  Param-driven (a meeting needs a title/duration/provider the
   *  trigger context can't infer), the same shape create_task's own
   *  executor already established, not the no-params
   *  analyze_lead_ai/analyze_conversation_ai shape. See
   *  lib/services/automation/actions/executors/scheduleMeeting.ts. */
  | "schedule_meeting";

export interface WorkflowActionSpec {
  type: WorkflowActionType;
  params: Record<string, unknown>;
}

export type WorkflowConditionType = "lead_not_registered";

export interface WorkflowConditionSpec {
  type: WorkflowConditionType;
  /** Human-readable reason, surfaced in logs when a step is skipped —
   *  same field WorkflowStepCondition carries today. */
  description: string;
  params?: Record<string, unknown>;
}

export interface PersistedWorkflowStep {
  id: string;
  delay?: WorkflowStepDelay;
  condition?: WorkflowConditionSpec;
  action: WorkflowActionSpec;
  retryPolicy?: RetryPolicy;
}

export interface WorkflowDefinitionRecord {
  id: string;
  name: string;
  triggerEventType: string;
  /** An inactive definition is not looked up by triggers.ts on new
   *  events, but existing WorkflowRuns already in flight against it
   *  keep advancing — "pause new starts," not "cancel what's running." */
  active: boolean;
  steps: PersistedWorkflowStep[];
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowDefinitionInput {
  id: string;
  name: string;
  triggerEventType: string;
  active?: boolean;
  steps: PersistedWorkflowStep[];
  organizationId?: string;
}

export interface UpdateWorkflowDefinitionInput {
  name?: string;
  active?: boolean;
  steps?: PersistedWorkflowStep[];
}

export interface WorkflowDefinitionRepository {
  create(input: CreateWorkflowDefinitionInput): Promise<WorkflowDefinitionRecord>;
  /** The engine's per-run lookup (by WorkflowRun.workflowId), admin CRUD,
   *  and triggers.ts all key off this same id. */
  findById(id: string): Promise<WorkflowDefinitionRecord | null>;
  list(): Promise<WorkflowDefinitionRecord[]>;
  /** triggers.ts's per-event lookup — every active definition that
   *  should start a new run when this event type fires. */
  findActiveByTriggerEventType(triggerEventType: string): Promise<WorkflowDefinitionRecord[]>;
  update(id: string, patch: UpdateWorkflowDefinitionInput): Promise<WorkflowDefinitionRecord>;
  /** Unconditional — the "refuse if a non-terminal WorkflowRun still
   *  references this id" guard (same shape as
   *  pipelineService.deletePipeline()'s Opportunity check) lives in
   *  ./definitions.ts's deleteWorkflowDefinition(), not here, since it
   *  reaches across into WorkflowRunRepository. */
  delete(id: string): Promise<void>;
}

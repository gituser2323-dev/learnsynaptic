export { registerAutomationTriggers } from "./triggers";
export { runDueWorkflowSteps, listWorkflowRuns } from "./engine";
// Added for Campaign Architecture's shared scheduler (approved decision
// 3) — bridges this module onto lib/services/scheduler without any
// change to triggers.ts/engine.ts/the workflow definitions themselves.
export { registerAutomationTickHandler, ensureAutomationTickScheduled } from "./schedulerIntegration";
// Module 3.1 — Persisted Workflow Definitions. Admin CRUD + the
// Automation page's (now DB-backed, admin-editable) workflow catalog.
export {
  listWorkflowCatalog,
  getWorkflowDefinitionRecord,
  createWorkflowDefinition,
  updateWorkflowDefinition,
  deleteWorkflowDefinition,
} from "./definitions";
export type { CreateWorkflowDefinitionResult, UpdateWorkflowDefinitionResult, DeleteWorkflowDefinitionResult } from "./definitions";
export type { WorkflowValidationError } from "./validation";
// Module 3.2 — Visual Workflow Builder. Dropdown source of truth,
// shared with the validator that checks against the same lists.
export { ACTION_TYPES, CONDITION_TYPES, DELAY_UNITS } from "./validation";
// Module 3.3 — Auto-Reply Engine.
export { autoReplyService } from "./autoReply";
export type {
  CreateAutoReplyRuleResult,
  UpdateAutoReplyRuleResult,
  AutoReplyRuleValidationError,
  AutoReplyRule,
  CreateAutoReplyRuleInput,
  UpdateAutoReplyRuleInput,
} from "./autoReply";
export type {
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowRunListFilters,
  WorkflowDefinition,
  WorkflowDefinitionRecord,
  PersistedWorkflowStep,
  WorkflowActionType,
  WorkflowActionSpec,
  WorkflowConditionType,
  WorkflowConditionSpec,
  WorkflowStep,
  WorkflowStepDelay,
  WorkflowStepCondition,
  RetryPolicy,
  WorkflowContext,
} from "./types";

// Deliberately NOT exported: startWorkflowRun/advanceWorkflowRun
// (engine.ts internals — triggers.ts and runDueWorkflowSteps() are the
// only sanctioned entry points), hydrateWorkflowDefinition/
// getWorkflowDefinition (engine.ts/triggers.ts internals), and every
// WorkflowRunRepository/WorkflowDefinitionRepository implementation.

import { getWorkflowDefinitionRepository, getWorkflowRunRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { getActionExecutor } from "./actions/registry";
import { getConditionEvaluator } from "./conditions/registry";
import { validateCreateWorkflowDefinitionInput, validateWorkflowSteps, type WorkflowValidationError } from "./validation";
import type { UpdateWorkflowDefinitionInput, WorkflowDefinition, WorkflowDefinitionRecord, WorkflowStep } from "./types";

export type CreateWorkflowDefinitionResult =
  | { success: true; definition: WorkflowDefinitionRecord }
  | { success: false; errors: WorkflowValidationError[] };

export type UpdateWorkflowDefinitionResult =
  | { success: true; definition: WorkflowDefinitionRecord }
  | { success: false; errors: WorkflowValidationError[] };

export type DeleteWorkflowDefinitionResult = { success: true } | { success: false; reason: string };

/**
 * Turns a persisted, JSON-safe WorkflowDefinitionRecord back into the
 * exact runtime WorkflowDefinition shape engine.ts has always consumed
 * — resolving each step's {type, params} action/condition spec against
 * the action/condition registries. engine.ts itself needed zero changes
 * to advanceWorkflowRun()'s actual step-execution logic; only where the
 * WorkflowDefinition comes from changed.
 */
export function hydrateWorkflowDefinition(record: WorkflowDefinitionRecord): WorkflowDefinition {
  const steps: WorkflowStep[] = record.steps.map((step) => ({
    id: step.id,
    delay: step.delay,
    retryPolicy: step.retryPolicy,
    condition: step.condition
      ? {
          description: step.condition.description,
          evaluate: (context) => getConditionEvaluator(step.condition!.type)(context, step.condition!.params ?? {}),
        }
      : undefined,
    execute: (context) => getActionExecutor(step.action.type)(context, step.action.params),
  }));

  return { id: record.id, name: record.name, triggerEventType: record.triggerEventType, steps };
}

/** engine.ts's per-run lookup — resolves a WorkflowRun.workflowId to a
 *  runnable definition, or undefined if it's been deleted since. */
export async function getWorkflowDefinition(id: string): Promise<WorkflowDefinition | undefined> {
  const repository = await getWorkflowDefinitionRepository();
  const record = await repository.findById(id);
  return record ? hydrateWorkflowDefinition(record) : undefined;
}

/** triggers.ts's per-event lookup — every active definition that should
 *  start a new run when this event type fires. */
export async function listActiveDefinitionsByTrigger(triggerEventType: string): Promise<WorkflowDefinitionRecord[]> {
  const repository = await getWorkflowDefinitionRepository();
  return repository.findActiveByTriggerEventType(triggerEventType);
}

/** Admin Dashboard — Automation page's workflow catalog. Unlike the old
 *  static listWorkflowCatalog(), this now reflects admin edits without a
 *  redeploy — the whole point of this module. */
export async function listWorkflowCatalog(): Promise<WorkflowDefinitionRecord[]> {
  const repository = await getWorkflowDefinitionRepository();
  return repository.list();
}

export async function getWorkflowDefinitionRecord(id: string): Promise<WorkflowDefinitionRecord | null> {
  const repository = await getWorkflowDefinitionRepository();
  return repository.findById(id);
}

export async function createWorkflowDefinition(
  input: unknown,
  context: AuditContext = {},
): Promise<CreateWorkflowDefinitionResult> {
  const validation = validateCreateWorkflowDefinitionInput(input);
  if (!validation.valid) return { success: false, errors: validation.errors };

  const repository = await getWorkflowDefinitionRepository();
  const existing = await repository.findById(validation.data.id);
  if (existing) {
    return { success: false, errors: [{ field: "id", message: `A workflow definition with id "${validation.data.id}" already exists.` }] };
  }

  const definition = await repository.create(validation.data);
  await auditLogService.record({
    action: AUDIT_ACTIONS.WORKFLOW_DEFINITION_CREATED,
    entityType: "WorkflowDefinition",
    entityId: definition.id,
    actorId: context.actorId,
    requestId: context.requestId,
    metadata: { name: definition.name, triggerEventType: definition.triggerEventType },
  });
  return { success: true, definition };
}

/**
 * Partial update — name/active/steps, each independently optional so a
 * simple "toggle active" call doesn't need to resend the full step
 * list. Steps, if provided, are validated with the same rules as
 * creation (reused from validation.ts, not duplicated).
 */
export async function updateWorkflowDefinition(
  id: string,
  input: unknown,
  context: AuditContext = {},
): Promise<UpdateWorkflowDefinitionResult> {
  const repository = await getWorkflowDefinitionRepository();
  const existing = await repository.findById(id);
  if (!existing) return { success: false, errors: [{ field: "id", message: `Workflow definition ${id} not found.` }] };

  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const errors: WorkflowValidationError[] = [];
  const patch: UpdateWorkflowDefinitionInput = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) errors.push({ field: "name", message: "Name cannot be empty." });
    else patch.name = name;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") errors.push({ field: "active", message: "active must be a boolean." });
    else patch.active = body.active;
  }

  if (body.steps !== undefined) {
    const stepsResult = validateWorkflowSteps(body.steps);
    if (!stepsResult.valid) errors.push(...stepsResult.errors);
    else patch.steps = stepsResult.data;
  }

  if (errors.length > 0) return { success: false, errors };

  const definition = await repository.update(id, patch);
  await auditLogService.record({
    action: AUDIT_ACTIONS.WORKFLOW_DEFINITION_UPDATED,
    entityType: "WorkflowDefinition",
    entityId: id,
    actorId: context.actorId,
    requestId: context.requestId,
    metadata: { patchedFields: Object.keys(patch) },
  });
  return { success: true, definition };
}

/**
 * Refuses deletion while any non-terminal WorkflowRun still references
 * this definition's id — the same "refuse if still in use" shape as
 * pipelineService.deletePipeline()'s Opportunity check. Runs the same
 * check across both non-terminal statuses since WorkflowRunListFilters
 * only accepts one status per call.
 */
export async function deleteWorkflowDefinition(id: string, context: AuditContext = {}): Promise<DeleteWorkflowDefinitionResult> {
  const repository = await getWorkflowDefinitionRepository();
  const existing = await repository.findById(id);
  if (!existing) return { success: false, reason: "Workflow definition not found." };

  const runRepository = await getWorkflowRunRepository();
  const [pending, waiting] = await Promise.all([
    runRepository.list({ workflowId: id, status: "pending" }, 1, 1),
    runRepository.list({ workflowId: id, status: "waiting" }, 1, 1),
  ]);
  const inFlight = pending.total + waiting.total;
  if (inFlight > 0) {
    return { success: false, reason: `${inFlight} workflow run(s) are still in flight against this definition.` };
  }

  await repository.delete(id);
  await auditLogService.record({
    action: AUDIT_ACTIONS.WORKFLOW_DEFINITION_DELETED,
    entityType: "WorkflowDefinition",
    entityId: id,
    actorId: context.actorId,
    requestId: context.requestId,
  });
  return { success: true };
}

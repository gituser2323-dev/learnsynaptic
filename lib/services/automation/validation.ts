import type {
  CreateWorkflowDefinitionInput,
  PersistedWorkflowStep,
  WorkflowActionType,
  WorkflowConditionType,
  WorkflowStepDelay,
} from "./types";

export interface WorkflowValidationError {
  field: string;
  message: string;
}

export type WorkflowValidationResult<T> = { valid: true; data: T } | { valid: false; errors: WorkflowValidationError[] };

// Exported so module 3.2's builder UI can drive its dropdowns from the
// same source of truth this validator checks against, instead of a
// second hand-maintained literal array that could silently drift.
export const ACTION_TYPES: WorkflowActionType[] = [
  "send_whatsapp_template",
  "assign_lead",
  "add_tag",
  "create_task",
  "send_email",
  "analyze_lead_ai",
  "analyze_conversation_ai",
  "schedule_meeting",
];
export const CONDITION_TYPES: WorkflowConditionType[] = ["lead_not_registered"];
export const DELAY_UNITS: WorkflowStepDelay["unit"][] = ["minutes", "hours", "days"];

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Server-side counterpart to WorkflowStepBuilder.tsx's own
 * `validateStepsClientSide()` (module 3.2) — that function's own doc
 * comment disclosed this exact gap: the API never checked that e.g.
 * `send_whatsapp_template.params.templateName` is actually present,
 * only that `action.type` itself is a recognized value. A step saved
 * via a direct API call (not through the admin UI) could previously
 * pass validation with an empty/missing required param and only fail
 * later, when a WorkflowRun actually reached that step (see
 * lib/services/automation/actions/executors/*.ts, every one of which
 * throws its own "requires a <param>" error at execute time — this
 * function checks the same required fields, just before persistence
 * instead of at run time). Kept in sync with the client's own checks
 * by design, not by a shared import: the client can't import this
 * file's non-type exports without pulling in server-only code (see
 * WorkflowStepBuilder.tsx's own comment on why it only imports
 * ACTION_TYPES/CONDITION_TYPES/DELAY_UNITS), so both sides list the
 * same required fields independently — a future new action type needs
 * both updated, the same as `defaultParamsFor`/`ActionParamsEditor`
 * already do for the UI side.
 */
function validateActionParams(
  actionType: WorkflowActionType,
  params: Record<string, unknown>,
  field: string,
  errors: WorkflowValidationError[],
): void {
  const str = (key: string): string => (typeof params[key] === "string" ? (params[key] as string).trim() : "");

  switch (actionType) {
    case "send_whatsapp_template":
      if (!str("templateName")) errors.push({ field, message: "send_whatsapp_template requires params.templateName." });
      break;
    case "assign_lead":
      if (!str("counsellorId")) errors.push({ field, message: "assign_lead requires params.counsellorId." });
      break;
    case "add_tag":
      if (!str("tagId")) errors.push({ field, message: "add_tag requires params.tagId." });
      break;
    case "create_task":
      if (!str("title")) errors.push({ field, message: "create_task requires params.title." });
      if (!str("assigneeId")) errors.push({ field, message: "create_task requires params.assigneeId." });
      break;
    case "send_email":
      if (!str("subject")) errors.push({ field, message: "send_email requires params.subject." });
      if (!str("body")) errors.push({ field, message: "send_email requires params.body." });
      break;
    case "schedule_meeting":
      if (!str("provider")) errors.push({ field, message: "schedule_meeting requires params.provider." });
      if (!str("title")) errors.push({ field, message: "schedule_meeting requires params.title." });
      break;
  }
}

function validateDelay(value: unknown, field: string, errors: WorkflowValidationError[]): WorkflowStepDelay | undefined {
  if (value === undefined) return undefined;
  const body = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : undefined;
  const unit = DELAY_UNITS.includes(body.unit as WorkflowStepDelay["unit"]) ? (body.unit as WorkflowStepDelay["unit"]) : undefined;
  if (amount === undefined || !unit) {
    errors.push({ field, message: `${field} must be { amount: positive number, unit: "minutes"|"hours"|"days" }.` });
    return undefined;
  }
  return { amount, unit };
}

/** Shared by createWorkflowDefinition and updateWorkflowDefinition — a
 *  step's shape doesn't change between the two operations. */
export function validateWorkflowSteps(input: unknown): WorkflowValidationResult<PersistedWorkflowStep[]> {
  const errors: WorkflowValidationError[] = [];
  if (!Array.isArray(input) || input.length === 0) {
    return { valid: false, errors: [{ field: "steps", message: "At least one step is required." }] };
  }

  const steps: PersistedWorkflowStep[] = [];
  const seenIds = new Set<string>();

  input.forEach((raw, index) => {
    const prefix = `steps[${index}]`;
    const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) errors.push({ field: `${prefix}.id`, message: "Step id is required." });
    else if (seenIds.has(id)) errors.push({ field: `${prefix}.id`, message: `Duplicate step id "${id}".` });
    seenIds.add(id);

    const delay = validateDelay(body.delay, `${prefix}.delay`, errors);

    const actionBody = (body.action && typeof body.action === "object" ? body.action : {}) as Record<string, unknown>;
    const actionType = ACTION_TYPES.includes(actionBody.type as WorkflowActionType)
      ? (actionBody.type as WorkflowActionType)
      : undefined;
    if (!actionType) {
      errors.push({ field: `${prefix}.action.type`, message: `action.type must be one of: ${ACTION_TYPES.join(", ")}.` });
    }
    const actionParams =
      actionBody.params && typeof actionBody.params === "object" ? (actionBody.params as Record<string, unknown>) : {};
    if (actionType) validateActionParams(actionType, actionParams, `${prefix}.action.params`, errors);

    let condition: PersistedWorkflowStep["condition"];
    if (body.condition !== undefined) {
      const conditionBody = (body.condition && typeof body.condition === "object" ? body.condition : {}) as Record<
        string,
        unknown
      >;
      const conditionType = CONDITION_TYPES.includes(conditionBody.type as WorkflowConditionType)
        ? (conditionBody.type as WorkflowConditionType)
        : undefined;
      const description = typeof conditionBody.description === "string" ? conditionBody.description : "";
      if (!conditionType || !description) {
        errors.push({
          field: `${prefix}.condition`,
          message: `condition must be { type: one of ${CONDITION_TYPES.join(", ")}, description: string }.`,
        });
      } else {
        condition = {
          type: conditionType,
          description,
          params:
            conditionBody.params && typeof conditionBody.params === "object"
              ? (conditionBody.params as Record<string, unknown>)
              : undefined,
        };
      }
    }

    let retryPolicy: PersistedWorkflowStep["retryPolicy"];
    if (body.retryPolicy !== undefined) {
      const retryBody = (body.retryPolicy && typeof body.retryPolicy === "object" ? body.retryPolicy : {}) as Record<
        string,
        unknown
      >;
      const maxAttempts = typeof retryBody.maxAttempts === "number" && retryBody.maxAttempts > 0 ? retryBody.maxAttempts : undefined;
      const backoff = validateDelay(retryBody.backoff, `${prefix}.retryPolicy.backoff`, errors);
      if (!maxAttempts || !backoff) {
        errors.push({ field: `${prefix}.retryPolicy`, message: "retryPolicy must be { maxAttempts: positive number, backoff: delay }." });
      } else {
        retryPolicy = { maxAttempts, backoff };
      }
    }

    if (actionType) {
      steps.push({ id, delay, action: { type: actionType, params: actionParams }, condition, retryPolicy });
    }
  });

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: steps };
}

export function validateCreateWorkflowDefinitionInput(input: unknown): WorkflowValidationResult<CreateWorkflowDefinitionInput> {
  const errors: WorkflowValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) errors.push({ field: "id", message: "Id is required." });
  else if (!ID_RE.test(id)) {
    errors.push({ field: "id", message: "Id must be lowercase letters, digits, and hyphens only, e.g. \"lead-nurture-sequence\"." });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.push({ field: "name", message: "Name is required." });

  const triggerEventType = typeof body.triggerEventType === "string" ? body.triggerEventType.trim() : "";
  if (!triggerEventType) errors.push({ field: "triggerEventType", message: "Trigger event type is required." });

  const active = typeof body.active === "boolean" ? body.active : true;

  const stepsResult = validateWorkflowSteps(body.steps);
  if (!stepsResult.valid) errors.push(...stepsResult.errors);

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    data: { id, name, triggerEventType, active, steps: (stepsResult as { valid: true; data: PersistedWorkflowStep[] }).data },
  };
}

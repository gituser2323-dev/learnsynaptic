import type { CreateTaskInput, TaskPriority, TaskRecurrence } from "./types";

export interface TaskValidationError {
  field: string;
  message: string;
}

export type TaskValidationResult =
  | { valid: true; data: CreateTaskInput }
  | { valid: false; errors: TaskValidationError[] };

const VALID_PRIORITIES: TaskPriority[] = ["low", "medium", "high"];
const VALID_RECURRENCE: TaskRecurrence[] = ["none", "daily", "weekly", "monthly"];

export function validateCreateTaskInput(input: unknown): TaskValidationResult {
  const errors: TaskValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) errors.push({ field: "title", message: "Title is required." });

  const dueAt = typeof body.dueAt === "string" ? body.dueAt : "";
  if (!dueAt || Number.isNaN(Date.parse(dueAt))) {
    errors.push({ field: "dueAt", message: "A valid due date is required." });
  }

  const assigneeId = typeof body.assigneeId === "string" ? body.assigneeId.trim() : "";
  if (!assigneeId) errors.push({ field: "assigneeId", message: "A task must be assigned to someone." });

  const priority = (body.priority as TaskPriority) ?? "medium";
  if (!VALID_PRIORITIES.includes(priority)) {
    errors.push({ field: "priority", message: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}.` });
  }

  const recurrence = (body.recurrence as TaskRecurrence) ?? "none";
  if (!VALID_RECURRENCE.includes(recurrence)) {
    errors.push({ field: "recurrence", message: `Recurrence must be one of: ${VALID_RECURRENCE.join(", ")}.` });
  }

  const entityType = body.entityType === "Lead" ? "Lead" : undefined;
  const entityId = entityType && typeof body.entityId === "string" ? body.entityId : undefined;
  const description = typeof body.description === "string" ? body.description.trim() || undefined : undefined;
  const reminderAt = typeof body.reminderAt === "string" && !Number.isNaN(Date.parse(body.reminderAt)) ? body.reminderAt : undefined;
  // Enterprise Analytics (Phase 7), module 7.2 — set only by the
  // automation engine's own create_task executor, never by a real HTTP
  // request body (no admin UI form field exposes it), but still routed
  // through the same validated shape rather than bypassing this
  // function, so createTask.ts stays a normal taskService.createTask()
  // caller like every other call site.
  const workflowRunId = typeof body.workflowRunId === "string" ? body.workflowRunId : undefined;

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    data: { title, description, dueAt, priority, assigneeId, entityType, entityId, recurrence, reminderAt, workflowRunId },
  };
}

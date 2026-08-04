import { taskService } from "@/lib/services/crm/tasks";
import type { TaskPriority } from "@/lib/services/crm/tasks";
import type { WorkflowActionExecutor } from "../types";

const VALID_PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

/**
 * One of 3.1's four action targets — reuses taskService.createTask()
 * (1.2's territory). dueInDays is relative to when the step actually
 * executes (not when the definition was authored), matching every other
 * step's delay/backoff being wall-clock-relative rather than a fixed
 * timestamp baked into the definition.
 */
export const createTask: WorkflowActionExecutor = async (context, params) => {
  const title = typeof params.title === "string" ? params.title : "";
  if (!title) throw new Error("create_task action requires a title param.");

  const assigneeId = typeof params.assigneeId === "string" ? params.assigneeId : "";
  if (!assigneeId) throw new Error("create_task action requires an assigneeId param.");

  const dueInDays = typeof params.dueInDays === "number" && params.dueInDays >= 0 ? params.dueInDays : 1;
  const priority = VALID_PRIORITIES.includes(params.priority as TaskPriority)
    ? (params.priority as TaskPriority)
    : "medium";

  const dueAt = new Date(Date.now() + dueInDays * 86_400_000).toISOString();

  const result = await taskService.createTask({
    title,
    description: typeof params.description === "string" ? params.description : undefined,
    dueAt,
    priority,
    assigneeId,
    entityType: context.entityType === "Lead" ? "Lead" : undefined,
    entityId: context.entityType === "Lead" ? context.entityId : undefined,
    workflowRunId: context.runId,
  });

  if (!result.success) {
    throw new Error(`create_task action failed validation: ${result.errors.map((e) => e.message).join(", ")}`);
  }
};

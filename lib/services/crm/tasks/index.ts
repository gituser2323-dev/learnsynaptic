export { taskService } from "./taskService";
export type { CreateTaskResult } from "./taskService";
export { registerTaskReminderTickHandler, ensureTaskReminderTickScheduled } from "./schedulerIntegration";
export type { TaskValidationError } from "./validation";
export type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskRecurrence,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListFilters,
  TaskRepository,
} from "./types";

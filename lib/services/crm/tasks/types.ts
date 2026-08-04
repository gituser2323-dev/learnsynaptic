import type { PaginatedResult } from "@/lib/pagination";

/** Task domain layer — Enterprise CRM (Phase 1). A Task may optionally
 *  link to a Lead (entityType/entityId) — "Counsellor Tasks" (personal,
 *  not lead-specific) are simply a Task with no entity link, not a
 *  separate type. */

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "completed";
export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly";

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueAt: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string;
  entityType?: "Lead";
  entityId?: string;
  /** Enterprise Analytics (Phase 7), module 7.2 — set only by
   *  createTask.ts (the automation engine's own create_task executor).
   *  Unset for every manually-created task — the honest join
   *  "automation-generated tasks" analytics needs. */
  workflowRunId?: string;
  recurrence: TaskRecurrence;
  /** ISO — when to fire the due-soon reminder; defaults to dueAt itself
   *  if not set explicitly at creation. */
  reminderAt?: string;
  reminderSentAt?: string;
  completedAt?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueAt: string;
  priority?: TaskPriority;
  assigneeId: string;
  entityType?: "Lead";
  entityId?: string;
  workflowRunId?: string;
  recurrence?: TaskRecurrence;
  reminderAt?: string;
  organizationId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  dueAt?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigneeId?: string;
  reminderAt?: string;
  reminderSentAt?: string;
  completedAt?: string;
}

export interface TaskListFilters {
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  entityType?: "Lead";
  entityId?: string;
  dueBefore?: string;
  dueAfter?: string;
  /** Enterprise Analytics (Phase 7), module 7.2. */
  workflowRunId?: string;
  /** true: only tasks some WorkflowRun created — the account-wide
   *  "automation-generated tasks" count, without an N+1 per-run query. */
  hasWorkflowRunId?: boolean;
  createdAfter?: string;
  createdBefore?: string;
}

export interface TaskRepository {
  findById(id: string): Promise<Task | null>;
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, input: UpdateTaskInput): Promise<Task>;
  list(filters: TaskListFilters, page: number, limit: number): Promise<PaginatedResult<Task>>;
  /** The reminder poller's own query: due-soon/overdue tasks that
   *  haven't been reminded yet. */
  findPendingReminders(before: Date): Promise<Task[]>;
}

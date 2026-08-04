import { randomUUID } from "crypto";
import { buildPaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type { CreateTaskInput, Task, TaskListFilters, TaskRepository, UpdateTaskInput } from "@/lib/services/crm/tasks/types";

const store: Task[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryTaskRepository: TaskRepository = {
  async findById(id: string): Promise<Task | null> {
    return findOwnedByTenant(store, (t) => t.id === id) ?? null;
  },

  async create(input: CreateTaskInput): Promise<Task> {
    const task: Task = stampTenant({
      ...input,
      id: randomUUID(),
      priority: input.priority ?? "medium",
      status: "open",
      recurrence: input.recurrence ?? "none",
      reminderAt: input.reminderAt ?? input.dueAt,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(task);
    return task;
  },

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const task = findOwnedByTenant(store, (t) => t.id === id);
    if (!task) throw new Error(`Task ${id} not found`);
    Object.assign(task, input, { updatedAt: nowIso() });
    return task;
  },

  async list(filters: TaskListFilters, page: number, limit: number) {
    let results = scopeToTenant(store);
    if (filters.assigneeId) results = results.filter((t) => t.assigneeId === filters.assigneeId);
    if (filters.status) results = results.filter((t) => t.status === filters.status);
    if (filters.priority) results = results.filter((t) => t.priority === filters.priority);
    if (filters.entityType) results = results.filter((t) => t.entityType === filters.entityType);
    if (filters.entityId) results = results.filter((t) => t.entityId === filters.entityId);
    if (filters.dueBefore) results = results.filter((t) => t.dueAt <= filters.dueBefore!);
    if (filters.dueAfter) results = results.filter((t) => t.dueAt >= filters.dueAfter!);
    if (filters.workflowRunId) results = results.filter((t) => t.workflowRunId === filters.workflowRunId);
    else if (filters.hasWorkflowRunId) results = results.filter((t) => !!t.workflowRunId);
    if (filters.createdAfter) results = results.filter((t) => t.createdAt >= filters.createdAfter!);
    if (filters.createdBefore) results = results.filter((t) => t.createdAt <= filters.createdBefore!);
    results.sort((a, b) => a.dueAt.localeCompare(b.dueAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async findPendingReminders(before: Date): Promise<Task[]> {
    const beforeIso = before.toISOString();
    return store.filter((t) => t.status === "open" && t.reminderAt && t.reminderAt <= beforeIso && !t.reminderSentAt);
  },
};

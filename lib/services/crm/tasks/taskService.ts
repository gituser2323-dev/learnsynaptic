import { getTaskRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { activityService } from "@/lib/services/crm/activities";
import { notificationService } from "@/lib/services/crm/notifications";
import { publish } from "@/lib/events";
import type { AuditContext } from "@/lib/services/auditLog";
import { validateCreateTaskInput, type TaskValidationError } from "./validation";
import type { PaginatedResult } from "@/lib/pagination";
import type { Task, TaskListFilters, UpdateTaskInput } from "./types";

export type CreateTaskResult = { success: true; task: Task } | { success: false; errors: TaskValidationError[] };

function addInterval(date: Date, recurrence: Task["recurrence"]): Date {
  const next = new Date(date);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  else if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  else if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}

export const taskService = {
  async createTask(input: unknown, context: AuditContext = {}): Promise<CreateTaskResult> {
    const validation = validateCreateTaskInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const repository = await getTaskRepository();
    const task = await repository.create(validation.data);

    await auditLogService.record({
      action: AUDIT_ACTIONS.TASK_CREATED,
      entityType: "Task",
      entityId: task.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { assigneeId: task.assigneeId, dueAt: task.dueAt },
    });

    if (task.entityType === "Lead" && task.entityId) {
      await activityService.logSystemEvent("Lead", task.entityId, `Task created: "${task.title}"`);
    }
    await publish("task.created", { taskId: task.id, title: task.title, assigneeId: task.assigneeId, dueAt: task.dueAt, entityType: task.entityType, entityId: task.entityId });

    return { success: true, task };
  },

  async listTasks(filters: TaskListFilters, page = 1, limit = 20): Promise<PaginatedResult<Task>> {
    const repository = await getTaskRepository();
    return repository.list(filters, page, limit);
  },

  /** RBAC — the ownership check every counsellor-scoped Task route
   *  performs before acting ("is this actually assigned to me?"). */
  async getTask(id: string): Promise<Task | null> {
    const repository = await getTaskRepository();
    return repository.findById(id);
  },

  async completeTask(id: string, context: AuditContext = {}): Promise<Task> {
    const repository = await getTaskRepository();
    const existing = await repository.findById(id);
    if (!existing) throw new Error(`Task ${id} not found`);

    const completed = await repository.update(id, { status: "completed", completedAt: new Date().toISOString() });

    await auditLogService.record({
      action: AUDIT_ACTIONS.TASK_COMPLETED,
      entityType: "Task",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
    });

    if (completed.entityType === "Lead" && completed.entityId) {
      await activityService.logSystemEvent("Lead", completed.entityId, `Task completed: "${completed.title}"`);
    }
    await publish("task.completed", { taskId: id, title: completed.title, assigneeId: completed.assigneeId });

    // Recurring tasks spawn their next instance on completion, not on a
    // timer — a task due "every Monday" that's completed Tuesday should
    // still spawn from the actual completion date, not silently catch up
    // on a missed Monday.
    if (completed.recurrence !== "none") {
      const nextDueAt = addInterval(new Date(completed.dueAt), completed.recurrence).toISOString();
      await repository.create({
        title: completed.title,
        description: completed.description,
        dueAt: nextDueAt,
        priority: completed.priority,
        assigneeId: completed.assigneeId,
        entityType: completed.entityType,
        entityId: completed.entityId,
        recurrence: completed.recurrence,
      });
    }

    return completed;
  },

  async reassignTask(id: string, assigneeId: string, context: AuditContext = {}): Promise<Task> {
    const repository = await getTaskRepository();
    const task = await repository.update(id, { assigneeId });
    await auditLogService.record({
      action: AUDIT_ACTIONS.TASK_REASSIGNED,
      entityType: "Task",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { assigneeId },
    });
    return task;
  },

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    const repository = await getTaskRepository();
    return repository.update(id, input);
  },

  /** Called by the scheduler tick (schedulerIntegration.ts) — finds
   *  every open task whose reminderAt has passed and hasn't fired yet,
   *  creates a Notification, marks it sent. Never re-fires for the same
   *  task (reminderSentAt is the guard), same "never resend" discipline
   *  the WhatsApp Campaign Manager's retry-cap already established for
   *  a different resource. */
  async processPendingReminders(): Promise<number> {
    const repository = await getTaskRepository();
    const due = await repository.findPendingReminders(new Date());

    for (const task of due) {
      const isOverdue = new Date(task.dueAt).getTime() < Date.now();
      await notificationService.notify({
        userId: task.assigneeId,
        type: isOverdue ? "task_overdue" : "task_due_soon",
        entityType: "Task",
        entityId: task.id,
        message: isOverdue ? `Overdue: "${task.title}"` : `Due soon: "${task.title}"`,
        organizationId: task.organizationId,
      });
      if (isOverdue) {
        await publish("task.overdue", { taskId: task.id, title: task.title, assigneeId: task.assigneeId, dueAt: task.dueAt });
      }
      await repository.update(task.id, { reminderSentAt: new Date().toISOString() });
    }

    return due.length;
  },
};

import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { TaskModel, toTask } from "@/lib/db/models/task.model";
import { buildPaginatedResult } from "@/lib/pagination";
import type { CreateTaskInput, Task, TaskListFilters, TaskRepository, UpdateTaskInput } from "@/lib/services/crm/tasks/types";

export const mongodbTaskRepository: TaskRepository = {
  async findById(id: string): Promise<Task | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await TaskModel.findById(id).exec();
    return doc ? toTask(doc) : null;
  },

  async create(input: CreateTaskInput): Promise<Task> {
    await getConnection();
    const doc = await TaskModel.create({ ...input, reminderAt: input.reminderAt ?? input.dueAt });
    return toTask(doc);
  },

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    await getConnection();
    const doc = await TaskModel.findByIdAndUpdate(id, { $set: input }, { new: true }).exec();
    if (!doc) throw new Error(`Task ${id} not found`);
    return toTask(doc);
  },

  async list(filters: TaskListFilters, page: number, limit: number) {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.assigneeId) query.assigneeId = filters.assigneeId;
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.dueBefore || filters.dueAfter) {
      const range: Record<string, Date> = {};
      if (filters.dueBefore) range.$lte = new Date(filters.dueBefore);
      if (filters.dueAfter) range.$gte = new Date(filters.dueAfter);
      query.dueAt = range;
    }
    if (filters.workflowRunId) query.workflowRunId = filters.workflowRunId;
    else if (filters.hasWorkflowRunId) query.workflowRunId = { $exists: true, $ne: null };
    if (filters.createdAfter || filters.createdBefore) {
      const range: Record<string, Date> = {};
      if (filters.createdAfter) range.$gte = new Date(filters.createdAfter);
      if (filters.createdBefore) range.$lte = new Date(filters.createdBefore);
      query.createdAt = range;
    }

    const [docs, total] = await Promise.all([
      TaskModel.find(query).sort({ dueAt: 1 }).skip((page - 1) * limit).limit(limit).exec(),
      TaskModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toTask), total, { page, limit });
  },

  async findPendingReminders(before: Date): Promise<Task[]> {
    await getConnection();
    const docs = await TaskModel.find({
      status: "open",
      reminderAt: { $lte: before },
      reminderSentAt: { $exists: false },
    }).exec();
    return docs.map(toTask);
  },
};

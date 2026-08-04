import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Task } from "@/lib/services/crm/tasks/types";

export interface TaskDocument extends Document {
  title: string;
  description?: string;
  dueAt: Date;
  priority: string;
  status: string;
  assigneeId: Types.ObjectId;
  entityType?: string;
  entityId?: string;
  workflowRunId?: Types.ObjectId;
  recurrence: string;
  reminderAt?: Date;
  reminderSentAt?: Date;
  completedAt?: Date;
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<TaskDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    dueAt: { type: Date, required: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    status: { type: String, enum: ["open", "completed"], default: "open" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    entityType: { type: String, enum: ["Lead"] },
    entityId: { type: String },
    // Enterprise Analytics (Phase 7), module 7.2 — set only by the
    // automation engine's own create_task executor.
    workflowRunId: { type: Schema.Types.ObjectId, ref: "WorkflowRun" },
    recurrence: { type: String, enum: ["none", "daily", "weekly", "monthly"], default: "none" },
    reminderAt: { type: Date },
    reminderSentAt: { type: Date },
    completedAt: { type: Date },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// The Tasks list/calendar view's primary query: this assignee's tasks, due-soonest first.
taskSchema.index({ assigneeId: 1, dueAt: 1 });
// A Lead's own Tasks tab.
taskSchema.index({ entityType: 1, entityId: 1 });
// The reminder poller's due-query.
taskSchema.index({ status: 1, reminderAt: 1, reminderSentAt: 1 });
// Enterprise Analytics (Phase 7), module 7.2 — "how many tasks did this
// workflow create" and date-range-scoped automation analytics.
taskSchema.index({ workflowRunId: 1 });
taskSchema.index({ createdAt: -1 });

taskSchema.plugin(tenantScopePlugin);

export function toTask(doc: TaskDocument): Task {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    dueAt: doc.dueAt.toISOString(),
    priority: doc.priority as Task["priority"],
    status: doc.status as Task["status"],
    assigneeId: doc.assigneeId.toString(),
    entityType: doc.entityType as Task["entityType"],
    entityId: doc.entityId,
    workflowRunId: doc.workflowRunId?.toString(),
    recurrence: doc.recurrence as Task["recurrence"],
    reminderAt: doc.reminderAt?.toISOString(),
    reminderSentAt: doc.reminderSentAt?.toISOString(),
    completedAt: doc.completedAt?.toISOString(),
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const TaskModel: Model<TaskDocument> =
  (models.Task as Model<TaskDocument>) || model<TaskDocument>("Task", taskSchema);

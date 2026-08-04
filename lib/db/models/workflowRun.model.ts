import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { WorkflowRun, WorkflowRunStatus } from "@/lib/services/automation/types";

export interface WorkflowRunDocument extends Document {
  workflowId: string;
  entityType: string;
  entityId: string;
  context: Record<string, unknown>;
  currentStepIndex: number;
  status: string;
  nextRunAt: Date;
  attempts: number;
  lastError?: string;
  completionReason?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const workflowRunSchema = new Schema<WorkflowRunDocument>(
  {
    workflowId: { type: String, required: true, trim: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    context: { type: Schema.Types.Mixed, default: {} },
    currentStepIndex: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["pending", "waiting", "processing", "completed", "failed", "cancelled"],
      default: "pending",
    },
    nextRunAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String },
    completionReason: { type: String },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// The poller's primary query: "runs ready to advance right now."
workflowRunSchema.index({ status: 1, nextRunAt: 1 });
// "All active runs for this entity" — stops a run early on conversion.
workflowRunSchema.index({ entityType: 1, entityId: 1, status: 1 });
// Enterprise Analytics (Phase 7), module 7.2 — per-workflow, date-range
// scoped analytics (executions/success-rate/trend) and the account-wide
// automation analytics rollup.
workflowRunSchema.index({ workflowId: 1, createdAt: -1 });
workflowRunSchema.index({ createdAt: -1 });

workflowRunSchema.plugin(tenantScopePlugin);

export function toWorkflowRun(doc: WorkflowRunDocument): WorkflowRun {
  return {
    id: doc._id.toString(),
    workflowId: doc.workflowId,
    entityType: doc.entityType,
    entityId: doc.entityId,
    context: doc.context,
    currentStepIndex: doc.currentStepIndex,
    status: doc.status as WorkflowRunStatus,
    nextRunAt: doc.nextRunAt.toISOString(),
    attempts: doc.attempts,
    lastError: doc.lastError,
    completionReason: doc.completionReason,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const WorkflowRunModel: Model<WorkflowRunDocument> =
  (models.WorkflowRun as Model<WorkflowRunDocument>) ||
  model<WorkflowRunDocument>("WorkflowRun", workflowRunSchema);

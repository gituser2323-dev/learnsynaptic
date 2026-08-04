import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { ScheduledJob } from "@/lib/services/scheduler/types";

export interface ScheduledJobDocument extends Document {
  jobType: string;
  payload: Record<string, unknown>;
  status: string;
  runAt: Date;
  attempts: number;
  retryPolicy?: { maxAttempts: number; backoffMinutes: number[] };
  lastError?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const retryPolicySchema = new Schema(
  {
    maxAttempts: { type: Number, required: true },
    backoffMinutes: { type: [Number], required: true },
  },
  { _id: false },
);

const scheduledJobSchema = new Schema<ScheduledJobDocument>(
  {
    jobType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["pending", "processing", "completed", "failed", "dead_lettered", "cancelled"], default: "pending" },
    runAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    retryPolicy: { type: retryPolicySchema, required: false },
    lastError: { type: String },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// The poller's own query: due, still-pending jobs, oldest first.
scheduledJobSchema.index({ status: 1, runAt: 1 });
// Admin/debugging visibility: every job of a given type.
scheduledJobSchema.index({ jobType: 1 });

export function toScheduledJob(doc: ScheduledJobDocument): ScheduledJob {
  return {
    id: doc._id.toString(),
    jobType: doc.jobType,
    payload: doc.payload,
    status: doc.status as ScheduledJob["status"],
    runAt: doc.runAt.toISOString(),
    attempts: doc.attempts,
    retryPolicy: doc.retryPolicy,
    lastError: doc.lastError,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const ScheduledJobModel: Model<ScheduledJobDocument> =
  (models.ScheduledJob as Model<ScheduledJobDocument>) ||
  model<ScheduledJobDocument>("ScheduledJob", scheduledJobSchema);

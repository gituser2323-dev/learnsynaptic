import { Schema, model, models, type Document, type Model } from "mongoose";
import type { BackupLog, BackupLogStatus } from "@/lib/services/backupMonitoring/types";

export interface BackupLogDocument extends Document {
  status: BackupLogStatus;
  completedAt: Date;
  sizeBytes?: number;
  durationMs?: number;
  error?: string;
  createdAt: Date;
}

const backupLogSchema = new Schema<BackupLogDocument>(
  {
    status: { type: String, enum: ["success", "failure"], required: true },
    completedAt: { type: Date, required: true },
    sizeBytes: { type: Number },
    durationMs: { type: Number },
    error: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The one real read pattern: "what's the most recent backup result."
backupLogSchema.index({ completedAt: -1 });

export function toBackupLog(doc: BackupLogDocument): BackupLog {
  return {
    id: doc._id.toString(),
    status: doc.status,
    completedAt: doc.completedAt.toISOString(),
    sizeBytes: doc.sizeBytes,
    durationMs: doc.durationMs,
    error: doc.error,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const BackupLogModel: Model<BackupLogDocument> =
  (models.BackupLog as Model<BackupLogDocument>) || model<BackupLogDocument>("BackupLog", backupLogSchema);

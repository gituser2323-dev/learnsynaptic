import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { DataExportRequest, DataExportStatus } from "@/lib/services/dataExport/types";

export interface DataExportRequestDocument extends Document {
  status: DataExportStatus;
  requestedBy: Types.ObjectId;
  fileAssetId?: Types.ObjectId;
  error?: string;
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dataExportRequestSchema = new Schema<DataExportRequestDocument>(
  {
    status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileAssetId: { type: Schema.Types.ObjectId, ref: "FileAsset" },
    error: { type: String, trim: true, maxlength: 2000 },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

dataExportRequestSchema.index({ organizationId: 1, createdAt: -1 });
dataExportRequestSchema.plugin(tenantScopePlugin);

export function toDataExportRequest(doc: DataExportRequestDocument): DataExportRequest {
  return {
    id: doc._id.toString(),
    status: doc.status,
    requestedBy: doc.requestedBy.toString(),
    fileAssetId: doc.fileAssetId?.toString(),
    error: doc.error,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const DataExportRequestModel: Model<DataExportRequestDocument> =
  (models.DataExportRequest as Model<DataExportRequestDocument>) ||
  model<DataExportRequestDocument>("DataExportRequest", dataExportRequestSchema);

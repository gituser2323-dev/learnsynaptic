import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { FileAsset, FileCategory, FileVisibility, StorageProviderId } from "@/lib/services/storage/types";

export interface FileAssetDocument extends Document {
  provider: StorageProviderId;
  storageKey: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  category: FileCategory;
  checksum: string;
  visibility: FileVisibility;
  publicUrl?: string;
  uploadedBy?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const fileAssetSchema = new Schema<FileAssetDocument>(
  {
    provider: { type: String, enum: ["local", "aws_s3", "cloudinary"], required: true },
    storageKey: { type: String, required: true, index: true },
    originalFilename: { type: String, required: true },
    storedFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    extension: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    category: {
      type: String,
      enum: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "CSV", "AVATAR", "ORGANIZATION_ASSET", "WHATSAPP_MEDIA", "EMAIL_ATTACHMENT", "CRM_ATTACHMENT", "EXPORT", "OTHER"],
      required: true,
      index: true,
    },
    checksum: { type: String, required: true },
    visibility: { type: String, enum: ["public", "private"], required: true },
    publicUrl: { type: String },
    uploadedBy: { type: String },
    // Deliberately plain strings, not an enum — File is meant to be
    // reusable by modules that don't exist yet (see types.ts's own
    // doc comment); a closed union here would need editing per module.
    relatedEntityType: { type: String, index: true },
    relatedEntityId: { type: String, index: true },
    organizationId: { type: String, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

// The Lead/Conversation-attachments read pattern: every file for one
// entity, newest first, soft-deleted rows excluded by the repository.
fileAssetSchema.index({ relatedEntityType: 1, relatedEntityId: 1, createdAt: -1 });

fileAssetSchema.plugin(tenantScopePlugin);

export function toFileAsset(doc: FileAssetDocument): FileAsset {
  return {
    id: doc._id.toString(),
    provider: doc.provider,
    storageKey: doc.storageKey,
    originalFilename: doc.originalFilename,
    storedFilename: doc.storedFilename,
    mimeType: doc.mimeType,
    extension: doc.extension,
    sizeBytes: doc.sizeBytes,
    category: doc.category,
    checksum: doc.checksum,
    visibility: doc.visibility,
    publicUrl: doc.publicUrl,
    uploadedBy: doc.uploadedBy,
    relatedEntityType: doc.relatedEntityType,
    relatedEntityId: doc.relatedEntityId,
    organizationId: doc.organizationId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    deletedAt: doc.deletedAt?.toISOString(),
  };
}

export const FileAssetModel: Model<FileAssetDocument> =
  (models.FileAsset as Model<FileAssetDocument>) || model<FileAssetDocument>("FileAsset", fileAssetSchema);

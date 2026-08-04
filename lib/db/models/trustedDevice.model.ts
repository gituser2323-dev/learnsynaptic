import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { TrustedDevice } from "@/lib/services/auth/types";

export interface TrustedDeviceDocument extends Document {
  userId: Types.ObjectId;
  deviceTokenHash: string;
  expiresAt: Date;
  deviceName?: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

const trustedDeviceSchema = new Schema<TrustedDeviceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deviceTokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    deviceName: { type: String },
    lastUsedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

trustedDeviceSchema.index({ deviceTokenHash: 1 }, { unique: true });
trustedDeviceSchema.index({ userId: 1 });
trustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function toTrustedDevice(doc: TrustedDeviceDocument): TrustedDevice {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    deviceTokenHash: doc.deviceTokenHash,
    expiresAt: doc.expiresAt.toISOString(),
    deviceName: doc.deviceName,
    createdAt: doc.createdAt.toISOString(),
    lastUsedAt: doc.lastUsedAt?.toISOString(),
  };
}

export const TrustedDeviceModel: Model<TrustedDeviceDocument> =
  (models.TrustedDevice as Model<TrustedDeviceDocument>) ||
  model<TrustedDeviceDocument>("TrustedDevice", trustedDeviceSchema);

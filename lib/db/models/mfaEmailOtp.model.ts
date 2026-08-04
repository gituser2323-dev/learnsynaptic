import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { MfaEmailOtp } from "@/lib/services/auth/types";

export interface MfaEmailOtpDocument extends Document {
  userId: Types.ObjectId;
  codeHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const mfaEmailOtpSchema = new Schema<MfaEmailOtpDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

mfaEmailOtpSchema.index({ userId: 1, createdAt: -1 });
mfaEmailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function toMfaEmailOtp(doc: MfaEmailOtpDocument): MfaEmailOtp {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    codeHash: doc.codeHash,
    expiresAt: doc.expiresAt.toISOString(),
    usedAt: doc.usedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export const MfaEmailOtpModel: Model<MfaEmailOtpDocument> =
  (models.MfaEmailOtp as Model<MfaEmailOtpDocument>) || model<MfaEmailOtpDocument>("MfaEmailOtp", mfaEmailOtpSchema);

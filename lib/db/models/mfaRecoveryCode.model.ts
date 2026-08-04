import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { MfaRecoveryCode } from "@/lib/services/auth/types";

export interface MfaRecoveryCodeDocument extends Document {
  userId: Types.ObjectId;
  codeHash: string;
  usedAt?: Date;
  createdAt: Date;
}

const mfaRecoveryCodeSchema = new Schema<MfaRecoveryCodeDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    codeHash: { type: String, required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

mfaRecoveryCodeSchema.index({ userId: 1 });

export function toMfaRecoveryCode(doc: MfaRecoveryCodeDocument): MfaRecoveryCode {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    codeHash: doc.codeHash,
    usedAt: doc.usedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export const MfaRecoveryCodeModel: Model<MfaRecoveryCodeDocument> =
  (models.MfaRecoveryCode as Model<MfaRecoveryCodeDocument>) ||
  model<MfaRecoveryCodeDocument>("MfaRecoveryCode", mfaRecoveryCodeSchema);

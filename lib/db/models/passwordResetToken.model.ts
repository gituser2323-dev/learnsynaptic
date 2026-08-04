import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { PasswordResetToken } from "@/lib/services/auth/types";

export interface PasswordResetTokenDocument extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const passwordResetTokenSchema = new Schema<PasswordResetTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

passwordResetTokenSchema.index({ userId: 1 });
// TTL cleanup — same posture as RefreshToken's own expiry index.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function toPasswordResetToken(doc: PasswordResetTokenDocument): PasswordResetToken {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt.toISOString(),
    usedAt: doc.usedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export const PasswordResetTokenModel: Model<PasswordResetTokenDocument> =
  (models.PasswordResetToken as Model<PasswordResetTokenDocument>) ||
  model<PasswordResetTokenDocument>("PasswordResetToken", passwordResetTokenSchema);

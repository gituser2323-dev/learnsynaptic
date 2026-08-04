import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { EmailVerificationToken } from "@/lib/services/auth/types";

export interface EmailVerificationTokenDocument extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const emailVerificationTokenSchema = new Schema<EmailVerificationTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

emailVerificationTokenSchema.index({ userId: 1 });
emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function toEmailVerificationToken(doc: EmailVerificationTokenDocument): EmailVerificationToken {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt.toISOString(),
    usedAt: doc.usedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export const EmailVerificationTokenModel: Model<EmailVerificationTokenDocument> =
  (models.EmailVerificationToken as Model<EmailVerificationTokenDocument>) ||
  model<EmailVerificationTokenDocument>("EmailVerificationToken", emailVerificationTokenSchema);

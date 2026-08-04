import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { OAuthAccount } from "@/lib/services/auth/types";

export interface OAuthAccountDocument extends Document {
  userId: Types.ObjectId;
  provider: string;
  providerAccountId: string;
  email?: string;
  createdAt: Date;
}

const oauthAccountSchema = new Schema<OAuthAccountDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: ["google", "microsoft", "github"], required: true },
    providerAccountId: { type: String, required: true },
    email: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One external identity links to exactly one User — the real uniqueness
// constraint (a Google account can't be linked to two different staff
// accounts here).
oauthAccountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true });
oauthAccountSchema.index({ userId: 1 });

export function toOAuthAccount(doc: OAuthAccountDocument): OAuthAccount {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    provider: doc.provider as OAuthAccount["provider"],
    providerAccountId: doc.providerAccountId,
    email: doc.email,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const OAuthAccountModel: Model<OAuthAccountDocument> =
  (models.OAuthAccount as Model<OAuthAccountDocument>) ||
  model<OAuthAccountDocument>("OAuthAccount", oauthAccountSchema);

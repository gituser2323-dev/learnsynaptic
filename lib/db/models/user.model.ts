import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { User } from "@/lib/services/auth/types";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  role: string;
  status: string;
  name?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  /** RC-1 — Production Hardening: Authentication & Identity. See
   *  lib/services/auth/types.ts's own User doc comments for what each
   *  field means. */
  emailVerifiedAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  mfaEnabled: boolean;
  mfaSecretEncrypted?: string;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["counsellor", "manager", "admin"], required: true },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    name: { type: String, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    emailVerifiedAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecretEncrypted: { type: String },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true },
);

// Duplicate prevention: a second user with the same email is rejected by
// MongoDB itself, not just checked in application code (same pattern as
// Campaign.code).

export function toUser(doc: UserDocument): User {
  return {
    id: doc._id.toString(),
    email: doc.email,
    passwordHash: doc.passwordHash,
    role: doc.role as User["role"],
    status: doc.status as User["status"],
    name: doc.name,
    organizationId: doc.organizationId?.toString(),
    emailVerifiedAt: doc.emailVerifiedAt?.toISOString(),
    failedLoginAttempts: doc.failedLoginAttempts ?? 0,
    lockedUntil: doc.lockedUntil?.toISOString(),
    mfaEnabled: doc.mfaEnabled ?? false,
    mfaSecretEncrypted: doc.mfaSecretEncrypted,
    passwordChangedAt: doc.passwordChangedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const UserModel: Model<UserDocument> =
  (models.User as Model<UserDocument>) || model<UserDocument>("User", userSchema);

import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { RefreshTokenRecord } from "@/lib/services/auth/types";

export interface RefreshTokenDocument extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  /** RC-1 — session display metadata, captured once at issuance. See
   *  lib/services/auth/types.ts's own SessionMetadata doc comment. */
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  rememberMe: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    deviceName: { type: String },
    browser: { type: String },
    os: { type: String },
    ipAddress: { type: String },
    rememberMe: { type: Boolean, default: false },
    lastUsedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The one lookup every refresh/logout call makes.
// Reuse detection revokes every record sharing a family in one call.
refreshTokenSchema.index({ familyId: 1 });
// RC-1 — the Active Sessions panel's own lookup: every session for a user, newest first.
refreshTokenSchema.index({ userId: 1, createdAt: -1 });
// TTL index: MongoDB itself garbage-collects rows well past expiry — a
// cleanup mechanism, not the authorization check itself (authService
// still checks expiresAt/revokedAt explicitly, same as
// pruneExpiredAuditLogs() being separate from a live "is this valid"
// check — see lib/services/auditLog/retention.ts).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function toRefreshTokenRecord(doc: RefreshTokenDocument): RefreshTokenRecord {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    tokenHash: doc.tokenHash,
    familyId: doc.familyId,
    expiresAt: doc.expiresAt.toISOString(),
    revokedAt: doc.revokedAt?.toISOString(),
    organizationId: doc.organizationId?.toString(),
    deviceName: doc.deviceName,
    browser: doc.browser,
    os: doc.os,
    ipAddress: doc.ipAddress,
    rememberMe: doc.rememberMe ?? false,
    lastUsedAt: doc.lastUsedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export const RefreshTokenModel: Model<RefreshTokenDocument> =
  (models.RefreshToken as Model<RefreshTokenDocument>) ||
  model<RefreshTokenDocument>("RefreshToken", refreshTokenSchema);

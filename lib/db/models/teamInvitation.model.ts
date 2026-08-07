import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { TeamInvitation } from "@/lib/services/onboarding/invitationTypes";

export interface TeamInvitationDocument extends Document {
  organizationId: Types.ObjectId;
  email: string;
  role: string;
  status: string;
  invitedByUserId: string;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedByUserId?: string;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const teamInvitationSchema = new Schema<TeamInvitationDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, enum: ["counsellor", "manager", "admin"], required: true },
    status: { type: String, enum: ["pending", "accepted", "revoked", "expired"], default: "pending" },
    invitedByUserId: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    acceptedByUserId: { type: String },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

// "Is there already a pending invite for this email in this org" — the
// resend-instead-of-duplicate check invitationService.sendInvitation()
// runs on every call.
teamInvitationSchema.index({ organizationId: 1, email: 1, status: 1 });
// "How many pending invitations does this org have" — the seat-limit
// pre-check.
teamInvitationSchema.index({ organizationId: 1, status: 1 });

teamInvitationSchema.plugin(tenantScopePlugin);

export function toTeamInvitation(doc: TeamInvitationDocument): TeamInvitation {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    email: doc.email,
    role: doc.role as TeamInvitation["role"],
    status: doc.status as TeamInvitation["status"],
    invitedByUserId: doc.invitedByUserId,
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt.toISOString(),
    acceptedAt: doc.acceptedAt?.toISOString(),
    acceptedByUserId: doc.acceptedByUserId,
    revokedAt: doc.revokedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const TeamInvitationModel: Model<TeamInvitationDocument> =
  (models.TeamInvitation as Model<TeamInvitationDocument>) ||
  model<TeamInvitationDocument>("TeamInvitation", teamInvitationSchema);

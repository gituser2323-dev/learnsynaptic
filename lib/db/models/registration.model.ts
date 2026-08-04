import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Registration } from "@/lib/db/repositories/types";

export interface RegistrationDocument extends Document {
  leadId: Types.ObjectId;
  programSlug: string;
  programName?: string;
  cohortLabel?: string;
  status: string;
  source: string;
  campaignId?: Types.ObjectId;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const registrationSchema = new Schema<RegistrationDocument>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    programSlug: { type: String, required: true, trim: true },
    programName: { type: String, trim: true },
    cohortLabel: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
    source: { type: String, required: true, trim: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign" },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// Duplicate prevention: MongoDB itself rejects a second registration for
// the same lead + program, rather than relying solely on an application
// check-then-insert (which has a race window under concurrent requests).
registrationSchema.index({ leadId: 1, programSlug: 1 }, { unique: true });
// Supports "all registrations for this lead" and admin/cohort listing views.
registrationSchema.index({ programSlug: 1, status: 1 });
// Enterprise Analytics (Phase 7), module 7.2 — date-range scoped funnel
// analytics ("Enrolled" stage).
registrationSchema.index({ status: 1, createdAt: -1 });

registrationSchema.plugin(tenantScopePlugin);

export function toRegistration(doc: RegistrationDocument): Registration {
  return {
    id: doc._id.toString(),
    leadId: doc.leadId.toString(),
    programSlug: doc.programSlug,
    programName: doc.programName,
    cohortLabel: doc.cohortLabel,
    status: doc.status as Registration["status"],
    source: doc.source,
    campaignId: doc.campaignId?.toString(),
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const RegistrationModel: Model<RegistrationDocument> =
  (models.Registration as Model<RegistrationDocument>) ||
  model<RegistrationDocument>("Registration", registrationSchema);

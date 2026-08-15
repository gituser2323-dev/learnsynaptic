import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { LeadCaptureForm, LeadCaptureFormFields } from "@/lib/services/crm/leadCaptureForms/types";

const fieldConfigSchema = new Schema(
  {
    enabled: { type: Boolean, required: true, default: true },
    required: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

export interface LeadCaptureFormDocument extends Document {
  organizationId?: Types.ObjectId;
  name: string;
  publicSlug: string;
  active: boolean;
  fields: LeadCaptureFormFields;
  successMessage: string;
  submissionCount: number;
  duplicateCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const leadCaptureFormSchema = new Schema<LeadCaptureFormDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Globally unique, not compound with organizationId — see this
    // model's own domain-type doc comment (types.ts) for why: the public
    // URL (/forms/{slug}) carries no org prefix, so two organizations
    // picking the same slug would be genuinely ambiguous, not just a
    // same-tenant collision. Same shape as Organization.slug.
    publicSlug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    active: { type: Boolean, required: true, default: true },
    fields: {
      program: { type: fieldConfigSchema, required: true },
      message: { type: fieldConfigSchema, required: true },
    },
    successMessage: { type: String, required: true, trim: true, maxlength: 500 },
    submissionCount: { type: Number, required: true, default: 0 },
    duplicateCount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

leadCaptureFormSchema.plugin(tenantScopePlugin);

export function toLeadCaptureForm(doc: LeadCaptureFormDocument): LeadCaptureForm {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId?.toString(),
    name: doc.name,
    publicSlug: doc.publicSlug,
    active: doc.active,
    fields: doc.fields,
    successMessage: doc.successMessage,
    submissionCount: doc.submissionCount,
    duplicateCount: doc.duplicateCount,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const LeadCaptureFormModel: Model<LeadCaptureFormDocument> =
  (models.LeadCaptureForm as Model<LeadCaptureFormDocument>) ||
  model<LeadCaptureFormDocument>("LeadCaptureForm", leadCaptureFormSchema);

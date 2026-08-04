import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { CampaignTemplate } from "@/lib/services/whatsappCampaigns/types";

export interface CampaignTemplateDocument extends Document {
  name: string;
  metaTemplateName: string;
  languageCode: string;
  variableLabels: string[];
  approvalStatus: string;
  approvalStatusCheckedAt?: Date;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const campaignTemplateSchema = new Schema<CampaignTemplateDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    metaTemplateName: { type: String, required: true, trim: true },
    languageCode: { type: String, required: true, trim: true },
    variableLabels: { type: [String], default: [] },
    approvalStatus: { type: String, enum: ["unknown", "approved", "pending", "rejected"], default: "unknown" },
    approvalStatusCheckedAt: { type: Date },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// RC-1 — the only model in lib/db/models without an index before this;
// CampaignTemplateRepository.list() always sorts by createdAt descending
// (Admin Dashboard Templates page pagination), same reasoning as
// campaign.model.ts's own indexes.
campaignTemplateSchema.index({ createdAt: -1 });

campaignTemplateSchema.plugin(tenantScopePlugin);

export function toCampaignTemplate(doc: CampaignTemplateDocument): CampaignTemplate {
  return {
    id: doc._id.toString(),
    name: doc.name,
    metaTemplateName: doc.metaTemplateName,
    languageCode: doc.languageCode,
    variableLabels: doc.variableLabels,
    approvalStatus: (doc.approvalStatus as CampaignTemplate["approvalStatus"]) || "unknown",
    approvalStatusCheckedAt: doc.approvalStatusCheckedAt?.toISOString(),
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const CampaignTemplateModel: Model<CampaignTemplateDocument> =
  (models.CampaignTemplate as Model<CampaignTemplateDocument>) ||
  model<CampaignTemplateDocument>("CampaignTemplate", campaignTemplateSchema);

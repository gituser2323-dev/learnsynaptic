import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Campaign } from "@/lib/db/repositories/types";

export interface CampaignDocument extends Document {
  name: string;
  code: string;
  channel: string;
  status: string;
  startDate: Date;
  endDate?: Date;
  budgetInr?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  notes?: string;
  externalAdCampaignId?: string;
  registrationCount: number;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<CampaignDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    code: { type: String, required: true, trim: true, uppercase: true },
    channel: {
      type: String,
      enum: ["meta", "google", "organic", "referral", "email", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "ended"],
      default: "draft",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    budgetInr: { type: Number, min: 0 },
    utmSource: { type: String, trim: true },
    utmMedium: { type: String, trim: true },
    utmCampaign: { type: String, trim: true },
    notes: { type: String, trim: true },
    externalAdCampaignId: { type: String, trim: true },
    registrationCount: { type: Number, default: 0, min: 0 },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// Duplicate prevention: a second campaign with the same code is rejected
// by MongoDB itself, not just checked in application code.
// Business OS Phase 8, Module 8.1 — code is unique PER ORGANIZATION,
// not globally: two tenants each running their own "SUMMER24" campaign
// is the whole point of real multi-tenancy, and the old bare-`code`
// unique index would have silently rejected the second organization's
// otherwise-legitimate campaign as a duplicate.
campaignSchema.index({ organizationId: 1, code: 1 }, { unique: true });
// Supports "list active campaigns" and matching an inbound UTM campaign
// name back to the Campaign record that produced it.
campaignSchema.index({ status: 1 });
campaignSchema.index({ utmCampaign: 1 });

campaignSchema.plugin(tenantScopePlugin);

export function toCampaign(doc: CampaignDocument): Campaign {
  return {
    id: doc._id.toString(),
    name: doc.name,
    code: doc.code,
    channel: doc.channel as Campaign["channel"],
    status: doc.status as Campaign["status"],
    startDate: doc.startDate.toISOString(),
    endDate: doc.endDate?.toISOString(),
    budgetInr: doc.budgetInr,
    utmSource: doc.utmSource,
    utmMedium: doc.utmMedium,
    utmCampaign: doc.utmCampaign,
    notes: doc.notes,
    externalAdCampaignId: doc.externalAdCampaignId,
    registrationCount: doc.registrationCount,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const CampaignModel: Model<CampaignDocument> =
  (models.Campaign as Model<CampaignDocument>) || model<CampaignDocument>("Campaign", campaignSchema);

import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { CampaignRecurrenceRule, WhatsAppCampaign } from "@/lib/services/whatsappCampaigns/types";

interface CampaignRecurrenceRuleSubdoc {
  frequency: string;
  interval: number;
}

export interface WhatsAppCampaignDocument extends Document {
  name: string;
  status: string;
  templateId: string;
  audienceSource?: string;
  audienceSnapshotAt?: Date;
  scheduledFor?: Date;
  marketingCampaignId?: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  replyCount: number;
  clickCount: number;
  archived: boolean;
  clonedFromId?: string;
  recurrenceRule?: CampaignRecurrenceRuleSubdoc;
  lastError?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const whatsAppCampaignSchema = new Schema<WhatsAppCampaignDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    status: {
      type: String,
      enum: ["draft", "ready", "scheduled", "sending", "completed", "failed", "cancelled"],
      default: "draft",
    },
    templateId: { type: String, required: true },
    audienceSource: { type: String, enum: ["filter", "csv_import", "manual"] },
    audienceSnapshotAt: { type: Date },
    scheduledFor: { type: Date },
    marketingCampaignId: { type: String },
    recipientCount: { type: Number, default: 0, min: 0 },
    sentCount: { type: Number, default: 0, min: 0 },
    deliveredCount: { type: Number, default: 0, min: 0 },
    readCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    replyCount: { type: Number, default: 0, min: 0 },
    clickCount: { type: Number, default: 0, min: 0 },
    archived: { type: Boolean, default: false },
    clonedFromId: { type: String },
    recurrenceRule: {
      type: new Schema(
        { frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true }, interval: { type: Number, required: true, min: 1 } },
        { _id: false },
      ),
    },
    lastError: { type: String },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// Campaign History filtering; the promote-scheduled job's due-query.
whatsAppCampaignSchema.index({ status: 1 });
whatsAppCampaignSchema.index({ scheduledFor: 1 });
// Module 2.5 — the list page's default "exclude archived" query.
whatsAppCampaignSchema.index({ archived: 1 });

whatsAppCampaignSchema.plugin(tenantScopePlugin);

export function toWhatsAppCampaign(doc: WhatsAppCampaignDocument): WhatsAppCampaign {
  return {
    id: doc._id.toString(),
    name: doc.name,
    status: doc.status as WhatsAppCampaign["status"],
    templateId: doc.templateId,
    audienceSource: doc.audienceSource as WhatsAppCampaign["audienceSource"],
    audienceSnapshotAt: doc.audienceSnapshotAt?.toISOString(),
    scheduledFor: doc.scheduledFor?.toISOString(),
    marketingCampaignId: doc.marketingCampaignId,
    recipientCount: doc.recipientCount,
    sentCount: doc.sentCount,
    deliveredCount: doc.deliveredCount,
    readCount: doc.readCount,
    failedCount: doc.failedCount,
    replyCount: doc.replyCount ?? 0,
    clickCount: doc.clickCount ?? 0,
    archived: doc.archived ?? false,
    clonedFromId: doc.clonedFromId,
    recurrenceRule: doc.recurrenceRule
      ? { frequency: doc.recurrenceRule.frequency as CampaignRecurrenceRule["frequency"], interval: doc.recurrenceRule.interval }
      : undefined,
    lastError: doc.lastError,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const WhatsAppCampaignModel: Model<WhatsAppCampaignDocument> =
  (models.WhatsAppCampaign as Model<WhatsAppCampaignDocument>) ||
  model<WhatsAppCampaignDocument>("WhatsAppCampaign", whatsAppCampaignSchema);

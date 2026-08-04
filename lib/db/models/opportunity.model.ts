import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Opportunity } from "@/lib/services/crm/pipelines/types";

export interface OpportunityStageHistoryEntryDocument {
  stageId: Types.ObjectId;
  enteredAt: Date;
}

export interface OpportunityDocument extends Document {
  leadId: Types.ObjectId;
  pipelineId: Types.ObjectId;
  stageId: Types.ObjectId;
  status: string;
  expectedRevenueInr?: number;
  probability: number;
  lostReason?: string;
  ownerId?: Types.ObjectId;
  organizationId?: Types.ObjectId;
  stageHistory: OpportunityStageHistoryEntryDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const stageHistoryEntrySchema = new Schema<OpportunityStageHistoryEntryDocument>(
  {
    stageId: { type: Schema.Types.ObjectId, required: true },
    enteredAt: { type: Date, required: true },
  },
  { _id: false },
);

const opportunitySchema = new Schema<OpportunityDocument>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    pipelineId: { type: Schema.Types.ObjectId, ref: "Pipeline", required: true },
    stageId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ["open", "won", "lost"], default: "open" },
    expectedRevenueInr: { type: Number, min: 0 },
    probability: { type: Number, default: 50, min: 0, max: 100 },
    lostReason: { type: String, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    stageHistory: { type: [stageHistoryEntrySchema], default: [] },
  },
  { timestamps: true },
);

// The Kanban board's own query: this pipeline's cards, grouped by stage.
opportunitySchema.index({ pipelineId: 1, stageId: 1 });
opportunitySchema.index({ leadId: 1 });
opportunitySchema.index({ ownerId: 1, status: 1 });

opportunitySchema.plugin(tenantScopePlugin);

export function toOpportunity(doc: OpportunityDocument): Opportunity {
  return {
    id: doc._id.toString(),
    leadId: doc.leadId.toString(),
    pipelineId: doc.pipelineId.toString(),
    stageId: doc.stageId.toString(),
    status: doc.status as Opportunity["status"],
    expectedRevenueInr: doc.expectedRevenueInr,
    probability: doc.probability,
    lostReason: doc.lostReason,
    ownerId: doc.ownerId?.toString(),
    organizationId: doc.organizationId?.toString(),
    stageHistory: (doc.stageHistory ?? []).map((entry) => ({
      stageId: entry.stageId.toString(),
      enteredAt: entry.enteredAt.toISOString(),
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const OpportunityModel: Model<OpportunityDocument> =
  (models.Opportunity as Model<OpportunityDocument>) || model<OpportunityDocument>("Opportunity", opportunitySchema);

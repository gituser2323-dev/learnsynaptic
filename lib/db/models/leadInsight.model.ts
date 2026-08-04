import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { LeadInsight, LeadInsightStatus, LeadInsightTrigger } from "@/lib/services/crm/leadInsights/types";
import type { BuyingIntent, LeadHealth } from "@/lib/services/crm/scoring";

export interface LeadInsightDocument extends Document {
  leadId: string;
  status: LeadInsightStatus;
  score?: number;
  health?: LeadHealth;
  summary?: string;
  buyingIntent?: BuyingIntent;
  strengths?: string[];
  risks?: string[];
  nextAction?: string;
  confidence?: number;
  reasoning?: string;
  errorMessage?: string;
  providerId?: string;
  trigger: LeadInsightTrigger;
  actorId?: string;
  organizationId?: string;
  createdAt: Date;
}

const leadInsightSchema = new Schema<LeadInsightDocument>(
  {
    leadId: { type: String, required: true, index: true },
    status: { type: String, enum: ["ok", "unavailable", "error"], required: true },
    score: { type: Number },
    health: { type: String, enum: ["hot", "warm", "cold"] },
    summary: { type: String },
    buyingIntent: { type: String, enum: ["high", "medium", "low", "unknown"] },
    strengths: { type: [String], default: undefined },
    risks: { type: [String], default: undefined },
    nextAction: { type: String },
    confidence: { type: Number },
    reasoning: { type: String },
    errorMessage: { type: String },
    providerId: { type: String },
    trigger: { type: String, enum: ["manual", "automation"], required: true },
    actorId: { type: String },
    organizationId: { type: String, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The history panel's own query: a lead's insights, newest first.
leadInsightSchema.index({ leadId: 1, createdAt: -1 });

leadInsightSchema.plugin(tenantScopePlugin);

export function toLeadInsight(doc: LeadInsightDocument): LeadInsight {
  return {
    id: doc._id.toString(),
    leadId: doc.leadId,
    status: doc.status,
    score: doc.score,
    health: doc.health,
    summary: doc.summary,
    buyingIntent: doc.buyingIntent,
    strengths: doc.strengths,
    risks: doc.risks,
    nextAction: doc.nextAction,
    confidence: doc.confidence,
    reasoning: doc.reasoning,
    errorMessage: doc.errorMessage,
    providerId: doc.providerId,
    trigger: doc.trigger,
    actorId: doc.actorId,
    organizationId: doc.organizationId,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const LeadInsightModel: Model<LeadInsightDocument> =
  (models.LeadInsight as Model<LeadInsightDocument>) || model<LeadInsightDocument>("LeadInsight", leadInsightSchema);

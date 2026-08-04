import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type {
  ConversationInsight,
  ConversationInsightStatus,
  ConversationInsightTrigger,
  ConversationIntent,
  ConversationSentiment,
} from "@/lib/services/conversations/insights/types";

export interface ConversationInsightDocument extends Document {
  conversationId: string;
  leadId?: string;
  status: ConversationInsightStatus;
  sentiment?: ConversationSentiment;
  intent?: ConversationIntent;
  engagementScore?: number;
  buyingReadinessScore?: number;
  positiveSignals?: string[];
  negativeSignals?: string[];
  objections?: string[];
  summary?: string;
  keyTopics?: string[];
  missedOpportunities?: string[];
  suggestedActions?: string[];
  responseQualityNotes?: string;
  confidence?: number;
  reasoning?: string;
  errorMessage?: string;
  providerId?: string;
  trigger: ConversationInsightTrigger;
  actorId?: string;
  organizationId?: string;
  createdAt: Date;
}

const conversationInsightSchema = new Schema<ConversationInsightDocument>(
  {
    conversationId: { type: String, required: true, index: true },
    leadId: { type: String, index: true },
    status: { type: String, enum: ["ok", "unavailable", "error"], required: true },
    sentiment: { type: String, enum: ["positive", "neutral", "negative", "mixed"] },
    intent: {
      type: String,
      enum: ["inquiry", "ready_to_enroll", "price_negotiation", "objection", "support_request", "unresponsive", "other"],
    },
    engagementScore: { type: Number },
    buyingReadinessScore: { type: Number },
    positiveSignals: { type: [String], default: undefined },
    negativeSignals: { type: [String], default: undefined },
    objections: { type: [String], default: undefined },
    summary: { type: String },
    keyTopics: { type: [String], default: undefined },
    missedOpportunities: { type: [String], default: undefined },
    suggestedActions: { type: [String], default: undefined },
    responseQualityNotes: { type: String },
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

// The thread view's own query: a conversation's insights, newest first.
conversationInsightSchema.index({ conversationId: 1, createdAt: -1 });
// "Historical analytics for each lead" / trend analysis: every insight
// across every conversation a lead has had, newest first.
conversationInsightSchema.index({ leadId: 1, createdAt: -1 });

conversationInsightSchema.plugin(tenantScopePlugin);

export function toConversationInsight(doc: ConversationInsightDocument): ConversationInsight {
  return {
    id: doc._id.toString(),
    conversationId: doc.conversationId,
    leadId: doc.leadId,
    status: doc.status,
    sentiment: doc.sentiment,
    intent: doc.intent,
    engagementScore: doc.engagementScore,
    buyingReadinessScore: doc.buyingReadinessScore,
    positiveSignals: doc.positiveSignals,
    negativeSignals: doc.negativeSignals,
    objections: doc.objections,
    summary: doc.summary,
    keyTopics: doc.keyTopics,
    missedOpportunities: doc.missedOpportunities,
    suggestedActions: doc.suggestedActions,
    responseQualityNotes: doc.responseQualityNotes,
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

export const ConversationInsightModel: Model<ConversationInsightDocument> =
  (models.ConversationInsight as Model<ConversationInsightDocument>) ||
  model<ConversationInsightDocument>("ConversationInsight", conversationInsightSchema);

import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { IntegrationLog, IntegrationLogEventType, IntegrationLogOutcome } from "@/lib/services/integrations/types";

export interface IntegrationLogDocument extends Document {
  providerId: string;
  eventType: IntegrationLogEventType;
  outcome: IntegrationLogOutcome;
  detail: string;
  actorId?: string;
  organizationId?: string;
  createdAt: Date;
}

const integrationLogSchema = new Schema<IntegrationLogDocument>(
  {
    providerId: { type: String, required: true, index: true },
    eventType: { type: String, enum: ["connect", "disconnect", "enable", "disable", "config_updated", "sync", "health_check"], required: true },
    outcome: { type: String, enum: ["success", "failure"], required: true },
    detail: { type: String, required: true, trim: true, maxlength: 500 },
    actorId: { type: String },
    organizationId: { type: String, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The registry's own query: a provider's log history, newest first.
integrationLogSchema.index({ providerId: 1, createdAt: -1 });

integrationLogSchema.plugin(tenantScopePlugin);

export function toIntegrationLog(doc: IntegrationLogDocument): IntegrationLog {
  return {
    id: doc._id.toString(),
    providerId: doc.providerId,
    eventType: doc.eventType,
    outcome: doc.outcome,
    detail: doc.detail,
    actorId: doc.actorId,
    organizationId: doc.organizationId,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const IntegrationLogModel: Model<IntegrationLogDocument> =
  (models.IntegrationLog as Model<IntegrationLogDocument>) || model<IntegrationLogDocument>("IntegrationLog", integrationLogSchema);

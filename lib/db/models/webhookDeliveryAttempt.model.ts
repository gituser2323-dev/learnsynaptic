import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { WebhookDeliveryAttempt, WebhookDeliveryOutcome } from "@/lib/services/webhooks/types";

export interface WebhookDeliveryAttemptDocument extends Document {
  endpointId: string;
  eventId: string;
  eventType: string;
  payloadSnapshot: Record<string, unknown>;
  attempt: number;
  httpStatusCode?: number;
  responseSnippet?: string;
  outcome: WebhookDeliveryOutcome;
  error?: string;
  scheduledJobId?: string;
  organizationId?: string;
  createdAt: Date;
  deliveredAt?: Date;
}

const webhookDeliveryAttemptSchema = new Schema<WebhookDeliveryAttemptDocument>(
  {
    endpointId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    payloadSnapshot: { type: Schema.Types.Mixed, default: {} },
    attempt: { type: Number, required: true },
    httpStatusCode: { type: Number },
    responseSnippet: { type: String, maxlength: 1000 },
    outcome: { type: String, enum: ["pending", "delivered", "failed", "dead_letter"], required: true, index: true },
    error: { type: String, maxlength: 500 },
    scheduledJobId: { type: String },
    organizationId: { type: String, index: true },
    deliveredAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The admin Delivery History read pattern: every attempt for one
// endpoint, newest first.
webhookDeliveryAttemptSchema.index({ endpointId: 1, createdAt: -1 });

webhookDeliveryAttemptSchema.plugin(tenantScopePlugin);

export function toWebhookDeliveryAttempt(doc: WebhookDeliveryAttemptDocument): WebhookDeliveryAttempt {
  return {
    id: doc._id.toString(),
    endpointId: doc.endpointId,
    eventId: doc.eventId,
    eventType: doc.eventType,
    payloadSnapshot: doc.payloadSnapshot,
    attempt: doc.attempt,
    httpStatusCode: doc.httpStatusCode,
    responseSnippet: doc.responseSnippet,
    outcome: doc.outcome,
    error: doc.error,
    scheduledJobId: doc.scheduledJobId,
    organizationId: doc.organizationId,
    createdAt: doc.createdAt.toISOString(),
    deliveredAt: doc.deliveredAt?.toISOString(),
  };
}

export const WebhookDeliveryAttemptModel: Model<WebhookDeliveryAttemptDocument> =
  (models.WebhookDeliveryAttempt as Model<WebhookDeliveryAttemptDocument>) ||
  model<WebhookDeliveryAttemptDocument>("WebhookDeliveryAttempt", webhookDeliveryAttemptSchema);

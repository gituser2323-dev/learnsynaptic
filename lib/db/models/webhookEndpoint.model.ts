import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { WebhookEndpoint, WebhookEndpointStatus } from "@/lib/services/webhooks/types";

export interface WebhookEndpointDocument extends Document {
  name: string;
  url: string;
  encryptedSecret: string;
  subscribedEventTypes: string[];
  status: WebhookEndpointStatus;
  consecutiveFailures: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastFailureReason?: string;
  createdBy?: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const webhookEndpointSchema = new Schema<WebhookEndpointDocument>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    encryptedSecret: { type: String, required: true },
    subscribedEventTypes: { type: [String], default: ["*"] },
    status: { type: String, enum: ["active", "disabled", "auto_disabled"], required: true, index: true },
    consecutiveFailures: { type: Number, default: 0 },
    lastSuccessAt: { type: Date },
    lastFailureAt: { type: Date },
    lastFailureReason: { type: String },
    createdBy: { type: String },
    organizationId: { type: String, index: true },
  },
  { timestamps: true },
);

webhookEndpointSchema.plugin(tenantScopePlugin);

export function toWebhookEndpoint(doc: WebhookEndpointDocument): WebhookEndpoint {
  return {
    id: doc._id.toString(),
    name: doc.name,
    url: doc.url,
    encryptedSecret: doc.encryptedSecret,
    subscribedEventTypes: doc.subscribedEventTypes,
    status: doc.status,
    consecutiveFailures: doc.consecutiveFailures,
    lastSuccessAt: doc.lastSuccessAt?.toISOString(),
    lastFailureAt: doc.lastFailureAt?.toISOString(),
    lastFailureReason: doc.lastFailureReason,
    createdBy: doc.createdBy,
    organizationId: doc.organizationId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const WebhookEndpointModel: Model<WebhookEndpointDocument> =
  (models.WebhookEndpoint as Model<WebhookEndpointDocument>) || model<WebhookEndpointDocument>("WebhookEndpoint", webhookEndpointSchema);

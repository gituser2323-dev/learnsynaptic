import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { WebhookDelivery, WebhookDeliveryOutcome } from "@/lib/services/webhookMonitoring/types";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";

export interface WebhookDeliveryDocument extends Document {
  source: string;
  outcome: WebhookDeliveryOutcome;
  eventCount: number;
  detail: string;
  createdAt: Date;
  /** Business OS Phase 8, Module 8.1 — added retroactively (this
   *  inbound-only log predates every other model's Phase 0 scaffolding
   *  too). Inbound webhook requests are unauthenticated by design (see
   *  Module 6.4/6.5's own doc comments — a provider's servers have no
   *  LearnSynaptic session), so there is no request-scoped tenant
   *  context to stamp this from automatically; the recording service
   *  stamps it explicitly with the deployment's one real connected
   *  account's org, the same disclosed single-tenant-in-practice
   *  posture phoneNumber.model.ts's own doc comment describes. */
  organizationId?: Types.ObjectId;
}

const webhookDeliverySchema = new Schema<WebhookDeliveryDocument>(
  {
    source: { type: String, required: true, index: true },
    outcome: { type: String, enum: ["processed", "unrecognized", "signature_invalid"], required: true },
    eventCount: { type: Number, required: true, default: 0 },
    detail: { type: String, required: true, trim: true, maxlength: 500 },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The admin panel's own query: recent deliveries, optionally filtered
// by source/outcome, newest first.
webhookDeliverySchema.index({ source: 1, outcome: 1, createdAt: -1 });

webhookDeliverySchema.plugin(tenantScopePlugin);

export function toWebhookDelivery(doc: WebhookDeliveryDocument): WebhookDelivery {
  return {
    id: doc._id.toString(),
    source: doc.source,
    outcome: doc.outcome,
    eventCount: doc.eventCount,
    detail: doc.detail,
    receivedAt: doc.createdAt.toISOString(),
  };
}

export const WebhookDeliveryModel: Model<WebhookDeliveryDocument> =
  (models.WebhookDelivery as Model<WebhookDeliveryDocument>) ||
  model<WebhookDeliveryDocument>("WebhookDelivery", webhookDeliverySchema);

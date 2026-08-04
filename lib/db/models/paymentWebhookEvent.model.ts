import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { PaymentProviderId, PaymentWebhookEvent, PaymentWebhookOutcome } from "@/lib/services/payments/types";

export interface PaymentWebhookEventDocument extends Document {
  provider: PaymentProviderId;
  providerEventId?: string;
  eventType: string;
  outcome: PaymentWebhookOutcome;
  paymentId?: string;
  detail?: string;
  organizationId?: string;
  receivedAt: Date;
}

const paymentWebhookEventSchema = new Schema<PaymentWebhookEventDocument>({
  provider: { type: String, enum: ["razorpay", "stripe", "cashfree", "phonepe", "paypal"], required: true, index: true },
  providerEventId: { type: String },
  eventType: { type: String, required: true },
  outcome: { type: String, enum: ["processed", "processing", "duplicate", "signature_invalid", "unrecognized", "error"], required: true, index: true },
  paymentId: { type: String, index: true },
  detail: { type: String },
  organizationId: { type: String, index: true },
  receivedAt: { type: Date, required: true, default: Date.now, index: true },
});

// RC-3 pentest fix — Idempotency: this MUST be a real unique index, not
// just a query-performance one. A plain (non-unique) index only speeds
// up the webhook handler's own read-check; it does nothing to stop two
// GENUINELY CONCURRENT deliveries of the same providerEventId from both
// passing that read before either finishes writing — the exact race
// this index closes at the database layer (see paymentService.
// handleProviderWebhook's own doc comment for the full fix).
//
// A PARTIAL index, deliberately — uniqueness only applies to the three
// outcomes that represent "a claim exists for this key" (processing:
// currently being handled; processed: already fully handled; error: a
// failed claim, reusable by a genuine retry — see the service's own
// doc comment). "duplicate" rows are explicitly NOT covered: one is
// logged per redundant delivery for admin visibility, and there can
// legitimately be many of them for the same providerEventId — they
// must never collide with each other or with the one real claim.
// "unrecognized"/"signature_invalid" never reach the claim step at all.
paymentWebhookEventSchema.index(
  { provider: 1, providerEventId: 1 },
  { unique: true, partialFilterExpression: { providerEventId: { $exists: true }, outcome: { $in: ["processing", "processed", "error"] } } },
);
paymentWebhookEventSchema.index({ receivedAt: -1 });

paymentWebhookEventSchema.plugin(tenantScopePlugin);

export function toPaymentWebhookEvent(doc: PaymentWebhookEventDocument): PaymentWebhookEvent {
  return {
    id: doc._id.toString(),
    provider: doc.provider,
    providerEventId: doc.providerEventId,
    eventType: doc.eventType,
    outcome: doc.outcome,
    paymentId: doc.paymentId,
    detail: doc.detail,
    organizationId: doc.organizationId,
    receivedAt: doc.receivedAt.toISOString(),
  };
}

export const PaymentWebhookEventModel: Model<PaymentWebhookEventDocument> =
  (models.PaymentWebhookEvent as Model<PaymentWebhookEventDocument>) || model<PaymentWebhookEventDocument>("PaymentWebhookEvent", paymentWebhookEventSchema);

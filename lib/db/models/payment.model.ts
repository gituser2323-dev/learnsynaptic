import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Payment, PaymentProviderId, PaymentStatus } from "@/lib/services/payments/types";

export interface PaymentDocument extends Document {
  provider: PaymentProviderId;
  providerOrderId?: string;
  providerPaymentId?: string;
  amountInSmallestUnit: number;
  currency: string;
  status: PaymentStatus;
  purpose: string;
  checkoutUrl?: string;
  failureReason?: string;
  refundedAmountInSmallestUnit: number;
  retryOfPaymentId?: string;
  leadId?: string;
  registrationId?: string;
  opportunityId?: string;
  campaignId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, string>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdBy?: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentDocument>(
  {
    provider: { type: String, enum: ["razorpay", "stripe", "cashfree", "phonepe", "paypal"], required: true, index: true },
    providerOrderId: { type: String, index: true },
    providerPaymentId: { type: String },
    amountInSmallestUnit: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ["created", "pending", "succeeded", "failed", "refunded", "partially_refunded"], required: true, index: true },
    purpose: { type: String, required: true },
    checkoutUrl: { type: String },
    failureReason: { type: String },
    refundedAmountInSmallestUnit: { type: Number, required: true, default: 0 },
    retryOfPaymentId: { type: String },
    leadId: { type: String, index: true },
    registrationId: { type: String, index: true },
    opportunityId: { type: String, index: true },
    campaignId: { type: String, index: true },
    customerName: { type: String },
    customerEmail: { type: String },
    customerPhone: { type: String },
    metadata: { type: Schema.Types.Mixed },
    // Deliberately plain strings, not an enum — mirrors FileAsset/
    // Meeting's own doc comment exactly: a Payment must stay reusable
    // by CRM entities that don't exist yet.
    relatedEntityType: { type: String, index: true },
    relatedEntityId: { type: String, index: true },
    createdBy: { type: String },
    organizationId: { type: String, index: true },
  },
  { timestamps: true },
);

// Transaction History / admin list default sort.
paymentSchema.index({ createdAt: -1 });
// The reconciliation job's own query.
paymentSchema.index({ status: 1, createdAt: 1 });
// findByProviderOrderId — the webhook path's own lookup.
paymentSchema.index({ provider: 1, providerOrderId: 1 });
// Enterprise Analytics (Phase 7), module 7.2 — revenue attribution by
// lead/campaign/opportunity, and per-counsellor revenue (via
// opportunityId -> Opportunity.ownerId).
paymentSchema.index({ leadId: 1, status: 1 });
paymentSchema.index({ campaignId: 1, status: 1 });
paymentSchema.index({ opportunityId: 1, status: 1 });

paymentSchema.plugin(tenantScopePlugin);

export function toPayment(doc: PaymentDocument): Payment {
  return {
    id: doc._id.toString(),
    provider: doc.provider,
    providerOrderId: doc.providerOrderId,
    providerPaymentId: doc.providerPaymentId,
    amountInSmallestUnit: doc.amountInSmallestUnit,
    currency: doc.currency,
    status: doc.status,
    purpose: doc.purpose,
    checkoutUrl: doc.checkoutUrl,
    failureReason: doc.failureReason,
    refundedAmountInSmallestUnit: doc.refundedAmountInSmallestUnit,
    retryOfPaymentId: doc.retryOfPaymentId,
    leadId: doc.leadId,
    registrationId: doc.registrationId,
    opportunityId: doc.opportunityId,
    campaignId: doc.campaignId,
    customerName: doc.customerName,
    customerEmail: doc.customerEmail,
    customerPhone: doc.customerPhone,
    metadata: doc.metadata,
    relatedEntityType: doc.relatedEntityType,
    relatedEntityId: doc.relatedEntityId,
    createdBy: doc.createdBy,
    organizationId: doc.organizationId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const PaymentModel: Model<PaymentDocument> = (models.Payment as Model<PaymentDocument>) || model<PaymentDocument>("Payment", paymentSchema);

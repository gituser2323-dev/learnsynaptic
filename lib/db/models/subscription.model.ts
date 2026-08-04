import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Subscription, SubscriptionStatus, SubscriptionProviderRef } from "@/lib/services/billing/types";

/**
 * Business OS Phase 8, Module 8.3 — one Subscription row per
 * organization (unique on `organizationId` — this app supports exactly
 * one active plan per tenant, no add-on-subscription concept yet).
 * Tenant-scoped via `tenantScopePlugin` like every other per-org
 * collection since Module 8.1 — `findAll()` (the scheduler's own
 * cross-tenant trial/period-rollover sweep) bypasses it via
 * `runCrossTenantSweep()`, the same exception `WorkflowRun`/`Payment`
 * already establish.
 */
export interface SubscriptionDocument extends Document {
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  cancelAt?: Date;
  cancelledAt?: Date;
  providerRef?: SubscriptionProviderRef;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    organizationId: { type: String, required: true },
    planId: { type: String, required: true },
    status: {
      type: String,
      enum: ["trialing", "active", "past_due", "cancelled", "suspended", "expired"],
      required: true,
    },
    startedAt: { type: Date, required: true },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    trialEndsAt: { type: Date },
    cancelAt: { type: Date },
    cancelledAt: { type: Date },
    providerRef: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

subscriptionSchema.index({ organizationId: 1 }, { unique: true });

subscriptionSchema.plugin(tenantScopePlugin);

export function toSubscription(doc: SubscriptionDocument): Subscription {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId,
    planId: doc.planId,
    status: doc.status,
    startedAt: doc.startedAt.toISOString(),
    currentPeriodStart: doc.currentPeriodStart.toISOString(),
    currentPeriodEnd: doc.currentPeriodEnd.toISOString(),
    trialEndsAt: doc.trialEndsAt?.toISOString(),
    cancelAt: doc.cancelAt?.toISOString(),
    cancelledAt: doc.cancelledAt?.toISOString(),
    providerRef: doc.providerRef,
    metadata: doc.metadata,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const SubscriptionModel: Model<SubscriptionDocument> =
  (models.Subscription as Model<SubscriptionDocument>) || model<SubscriptionDocument>("Subscription", subscriptionSchema);

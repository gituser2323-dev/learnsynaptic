import { Schema, model, models, type Document, type Model } from "mongoose";
import type { Plan, PlanStatus, BillingInterval, PlanCapability, PlanLimits } from "@/lib/services/billing/types";

/**
 * Business OS Phase 8, Module 8.3 — the global SaaS Plan catalog.
 * Deliberately NOT tenant-scoped (no `tenantScopePlugin`): a Plan is
 * platform-level configuration every organization reads, not
 * organization-owned data — the same distinction `providerCatalog.ts`
 * (Module 6.1) already draws between a static registry and per-org
 * `IntegrationConnection` rows. `id` is a caller-supplied stable slug
 * (`"starter"`, `"internal-unlimited"`), not an ObjectId, so a Plan's
 * identity survives being referenced by `Subscription.planId` even if
 * this collection is ever reseeded.
 */
export interface PlanDocument extends Document<string> {
  name: string;
  description: string;
  status: PlanStatus;
  billingInterval: BillingInterval;
  currency: string;
  basePriceInSmallestUnit: number;
  capabilities: PlanCapability[];
  limits: PlanLimits;
  trialDays: number;
  metadata?: Record<string, string>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<PlanDocument>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ["active", "archived", "draft"], required: true, default: "draft" },
    billingInterval: { type: String, enum: ["monthly", "yearly", "one_time", "internal"], required: true },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    basePriceInSmallestUnit: { type: Number, required: true, min: 0 },
    // Mixed by necessity: capabilities/limits are validated against the
    // real PLAN_CAPABILITIES/USAGE_METRICS unions at the service
    // boundary (validation.ts), not at the schema level — the same
    // posture IntegrationConnection.config already takes for its own
    // provider-varying shape.
    capabilities: { type: [String], default: [] },
    limits: { type: Schema.Types.Mixed, default: {} },
    trialDays: { type: Number, required: true, default: 0, min: 0 },
    metadata: { type: Schema.Types.Mixed },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true, _id: false },
);

export function toPlan(doc: PlanDocument): Plan {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description,
    status: doc.status,
    billingInterval: doc.billingInterval,
    currency: doc.currency,
    basePriceInSmallestUnit: doc.basePriceInSmallestUnit,
    capabilities: doc.capabilities ?? [],
    limits: doc.limits ?? {},
    trialDays: doc.trialDays,
    metadata: doc.metadata,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const PlanModel: Model<PlanDocument> = (models.Plan as Model<PlanDocument>) || model<PlanDocument>("Plan", planSchema);

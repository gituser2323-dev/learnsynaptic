import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { UsageCounter, UsageMetric } from "@/lib/services/billing/types";

/**
 * Business OS Phase 8, Module 8.3 — one row per (organizationId,
 * metric, period). Deliberately NOT derived by counting another
 * collection on every request (the mission's own explicit "avoid
 * expensive full-database counting") — this IS the counter, updated
 * atomically via `$inc` at the moment usage happens (see
 * `usageService.ts`'s own increment-then-compensate algorithm, the
 * real concurrency-safety mechanism this schema's unique index and
 * `$inc`'s own per-document atomicity make possible).
 */
export interface UsageCounterDocument extends Document {
  organizationId: string;
  metric: UsageMetric;
  period: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const usageCounterSchema = new Schema<UsageCounterDocument>(
  {
    organizationId: { type: String, required: true },
    metric: { type: String, required: true },
    period: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

usageCounterSchema.index({ organizationId: 1, metric: 1, period: 1 }, { unique: true });

usageCounterSchema.plugin(tenantScopePlugin);

export function toUsageCounter(doc: UsageCounterDocument): UsageCounter {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId,
    metric: doc.metric,
    period: doc.period,
    count: doc.count,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const UsageCounterModel: Model<UsageCounterDocument> =
  (models.UsageCounter as Model<UsageCounterDocument>) || model<UsageCounterDocument>("UsageCounter", usageCounterSchema);

import { Schema, model, models, type Document, type Model } from "mongoose";
import type { FeatureFlag } from "@/lib/services/billing/types";

/**
 * Business OS Phase 8, Module 8.3 — platform feature flags. Global,
 * NOT tenant-scoped (no `tenantScopePlugin`) — a flag is deployment-
 * level configuration an admin manages, distinct from a Plan's own
 * per-organization `capabilities` (see types.ts's own doc comment on
 * why these two are deliberately separate concepts). `key` is a stable
 * caller-chosen string (e.g. `"ai_reply_v2"`), unique, not an ObjectId
 * reference anywhere else in the app.
 */
export interface FeatureFlagDocument extends Document {
  key: string;
  description: string;
  enabled: boolean;
  organizationOverrides?: Record<string, boolean>;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const featureFlagSchema = new Schema<FeatureFlagDocument>(
  {
    key: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    enabled: { type: Boolean, required: true, default: false },
    organizationOverrides: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

featureFlagSchema.index({ key: 1 }, { unique: true });

export function toFeatureFlag(doc: FeatureFlagDocument): FeatureFlag {
  return {
    id: doc._id.toString(),
    key: doc.key,
    description: doc.description,
    enabled: doc.enabled,
    organizationOverrides: doc.organizationOverrides,
    metadata: doc.metadata,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const FeatureFlagModel: Model<FeatureFlagDocument> =
  (models.FeatureFlag as Model<FeatureFlagDocument>) || model<FeatureFlagDocument>("FeatureFlag", featureFlagSchema);

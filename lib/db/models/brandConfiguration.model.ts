import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { BrandConfiguration } from "@/lib/services/branding/types";

/**
 * Business OS Phase 8, Module 8.4 — one row per organization (unique
 * on `organizationId`), tenant-scoped via the existing
 * `tenantScopePlugin` like every other per-org collection since Module
 * 8.1. Stores only identity fields and FileAsset REFERENCES for
 * logo/favicon — the actual bytes live in Module 6.2's File Storage,
 * this collection never duplicates that.
 */
export interface BrandConfigurationDocument extends Document {
  organizationId: string;
  displayName?: string;
  logoFileId?: string;
  compactLogoFileId?: string;
  faviconFileId?: string;
  primaryColor?: string;
  accentColor?: string;
  supportEmail?: string;
  supportUrl?: string;
  websiteUrl?: string;
  footerText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const brandConfigurationSchema = new Schema<BrandConfigurationDocument>(
  {
    organizationId: { type: String, required: true },
    displayName: { type: String, trim: true, maxlength: 120 },
    logoFileId: { type: String },
    compactLogoFileId: { type: String },
    faviconFileId: { type: String },
    primaryColor: { type: String },
    accentColor: { type: String },
    supportEmail: { type: String, trim: true, maxlength: 254 },
    supportUrl: { type: String, trim: true, maxlength: 500 },
    websiteUrl: { type: String, trim: true, maxlength: 500 },
    footerText: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

brandConfigurationSchema.index({ organizationId: 1 }, { unique: true });

brandConfigurationSchema.plugin(tenantScopePlugin);

export function toBrandConfiguration(doc: BrandConfigurationDocument): BrandConfiguration {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId,
    displayName: doc.displayName,
    logoFileId: doc.logoFileId,
    compactLogoFileId: doc.compactLogoFileId,
    faviconFileId: doc.faviconFileId,
    primaryColor: doc.primaryColor,
    accentColor: doc.accentColor,
    supportEmail: doc.supportEmail,
    supportUrl: doc.supportUrl,
    websiteUrl: doc.websiteUrl,
    footerText: doc.footerText,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const BrandConfigurationModel: Model<BrandConfigurationDocument> =
  (models.BrandConfiguration as Model<BrandConfigurationDocument>) ||
  model<BrandConfigurationDocument>("BrandConfiguration", brandConfigurationSchema);

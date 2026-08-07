import { Schema, model, models, type Document, type Model } from "mongoose";
import type { Organization } from "@/lib/services/organizations/types";

export interface OrganizationDocument extends Document {
  name: string;
  slug: string;
  /** RC-6 — Platform Super Admin & SaaS Operations Console. See
   *  OrganizationStatus's own doc comment (lib/services/organizations/types.ts)
   *  — a separate axis from Subscription.status. */
  status: string;
  suspendedAt?: Date;
  suspendedReason?: string;
  /** RC-7 — Customer Onboarding & SaaS Activation. See each field's own
   *  doc comment on the shared `Organization` domain type
   *  (lib/services/organizations/types.ts) for what it's used for. */
  industry?: string;
  teamSize?: string;
  website?: string;
  country?: string;
  timezone?: string;
  onboarding?: { steps?: Record<string, string>; activatedAt?: string };
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    suspendedAt: { type: Date },
    suspendedReason: { type: String, trim: true, maxlength: 500 },
    industry: { type: String, trim: true, maxlength: 100 },
    teamSize: { type: String, enum: ["1-10", "11-50", "51-200", "201-1000", "1000+"] },
    website: { type: String, trim: true, maxlength: 300 },
    country: { type: String, trim: true, maxlength: 2, uppercase: true },
    timezone: { type: String, trim: true, maxlength: 100 },
    // Mixed — same "read fresh, replace the whole object" contract
    // UpdateOrganizationInput.onboarding's own doc comment describes,
    // the identical shape RC-6 already established for Subscription's
    // capabilityOverrides/limitOverrides.
    onboarding: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

// Duplicate prevention: a second organization with the same slug is
// rejected by MongoDB itself, same pattern as User.email/Campaign.code
// — enforced via the field's own `unique: true` above, not a second
// explicit index here (that was a real duplicate-index declaration,
// found and fixed during RC-4's own index-sync verification).

// RC-6 — the platform console's own "suspended organizations" filter
// and the suspension-enforcement check every gated write/job now runs
// (see RC-6 audit) both key off this field directly.
organizationSchema.index({ status: 1 });

export function toOrganization(doc: OrganizationDocument): Organization {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    status: (doc.status as Organization["status"]) ?? "active",
    suspendedAt: doc.suspendedAt?.toISOString(),
    suspendedReason: doc.suspendedReason,
    industry: doc.industry,
    teamSize: doc.teamSize as Organization["teamSize"],
    website: doc.website,
    country: doc.country,
    timezone: doc.timezone,
    onboarding: doc.onboarding as Organization["onboarding"],
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const OrganizationModel: Model<OrganizationDocument> =
  (models.Organization as Model<OrganizationDocument>) ||
  model<OrganizationDocument>("Organization", organizationSchema);

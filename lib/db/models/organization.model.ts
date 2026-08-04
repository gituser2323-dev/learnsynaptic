import { Schema, model, models, type Document, type Model } from "mongoose";
import type { Organization } from "@/lib/services/organizations/types";

export interface OrganizationDocument extends Document {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  },
  { timestamps: true },
);

// Duplicate prevention: a second organization with the same slug is
// rejected by MongoDB itself, same pattern as User.email/Campaign.code
// — enforced via the field's own `unique: true` above, not a second
// explicit index here (that was a real duplicate-index declaration,
// found and fixed during RC-4's own index-sync verification).

export function toOrganization(doc: OrganizationDocument): Organization {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const OrganizationModel: Model<OrganizationDocument> =
  (models.Organization as Model<OrganizationDocument>) ||
  model<OrganizationDocument>("Organization", organizationSchema);

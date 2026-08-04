import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Tag } from "@/lib/services/crm/tags/types";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export interface TagDocument extends Document {
  label: string;
  color: string;
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tagSchema = new Schema<TagDocument>(
  {
    label: { type: String, required: true, trim: true, maxlength: 40 },
    color: { type: String, required: true, match: HEX_COLOR_RE, default: "#6366f1" },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// Business OS Phase 8, Module 8.1 — label is unique PER ORGANIZATION —
// see campaign.model.ts's own index comment for the identical reasoning.
tagSchema.index({ organizationId: 1, label: 1 }, { unique: true });

tagSchema.plugin(tenantScopePlugin);

export function toTag(doc: TagDocument): Tag {
  return {
    id: doc._id.toString(),
    label: doc.label,
    color: doc.color,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const TagModel: Model<TagDocument> =
  (models.Tag as Model<TagDocument>) || model<TagDocument>("Tag", tagSchema);

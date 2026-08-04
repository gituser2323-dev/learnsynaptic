import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { CustomFieldDefinition } from "@/lib/services/crm/customFields/types";

export interface CustomFieldDefinitionDocument extends Document {
  key: string;
  label: string;
  fieldType: string;
  options?: string[];
  required: boolean;
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customFieldDefinitionSchema = new Schema<CustomFieldDefinitionDocument>(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    fieldType: {
      type: String,
      enum: ["text", "number", "date", "dropdown", "checkbox", "radio", "multiselect"],
      required: true,
    },
    options: { type: [String], default: undefined },
    required: { type: Boolean, default: false },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// Business OS Phase 8, Module 8.1 — key is unique PER ORGANIZATION —
// see campaign.model.ts's own index comment for the identical reasoning.
customFieldDefinitionSchema.index({ organizationId: 1, key: 1 }, { unique: true });

customFieldDefinitionSchema.plugin(tenantScopePlugin);

export function toCustomFieldDefinition(doc: CustomFieldDefinitionDocument): CustomFieldDefinition {
  return {
    id: doc._id.toString(),
    key: doc.key,
    label: doc.label,
    fieldType: doc.fieldType as CustomFieldDefinition["fieldType"],
    options: doc.options,
    required: doc.required,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const CustomFieldDefinitionModel: Model<CustomFieldDefinitionDocument> =
  (models.CustomFieldDefinition as Model<CustomFieldDefinitionDocument>) ||
  model<CustomFieldDefinitionDocument>("CustomFieldDefinition", customFieldDefinitionSchema);

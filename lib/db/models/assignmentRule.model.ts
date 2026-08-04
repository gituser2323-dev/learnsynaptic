import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { AssignmentRule } from "@/lib/services/crm/assignment/types";

export interface AssignmentRuleDocument extends Document {
  strategy: string;
  counsellorIds: Types.ObjectId[];
  active: boolean;
  nextIndex: number;
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentRuleSchema = new Schema<AssignmentRuleDocument>(
  {
    strategy: { type: String, enum: ["manual", "round_robin"], required: true },
    counsellorIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    active: { type: Boolean, default: true },
    nextIndex: { type: Number, default: 0, min: 0 },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

assignmentRuleSchema.index({ active: 1 });

assignmentRuleSchema.plugin(tenantScopePlugin);

export function toAssignmentRule(doc: AssignmentRuleDocument): AssignmentRule {
  return {
    id: doc._id.toString(),
    strategy: doc.strategy as AssignmentRule["strategy"],
    counsellorIds: doc.counsellorIds.map((id) => id.toString()),
    active: doc.active,
    nextIndex: doc.nextIndex,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const AssignmentRuleModel: Model<AssignmentRuleDocument> =
  (models.AssignmentRule as Model<AssignmentRuleDocument>) ||
  model<AssignmentRuleDocument>("AssignmentRule", assignmentRuleSchema);

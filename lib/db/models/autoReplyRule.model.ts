import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { AutoReplyRule } from "@/lib/services/automation/autoReply/types";

export interface AutoReplyRuleDocument extends Document {
  keywords: string[];
  replyText: string;
  isFallback: boolean;
  active: boolean;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const autoReplyRuleSchema = new Schema<AutoReplyRuleDocument>(
  {
    keywords: { type: [String], default: [] },
    replyText: { type: String, required: true, trim: true, maxlength: 1000 },
    isFallback: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// The matcher's own query: every active rule, oldest first.
autoReplyRuleSchema.index({ active: 1, createdAt: 1 });

autoReplyRuleSchema.plugin(tenantScopePlugin);

export function toAutoReplyRule(doc: AutoReplyRuleDocument): AutoReplyRule {
  return {
    id: doc._id.toString(),
    keywords: doc.keywords,
    replyText: doc.replyText,
    isFallback: doc.isFallback,
    active: doc.active,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const AutoReplyRuleModel: Model<AutoReplyRuleDocument> =
  (models.AutoReplyRule as Model<AutoReplyRuleDocument>) ||
  model<AutoReplyRuleDocument>("AutoReplyRule", autoReplyRuleSchema);

import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { MessageAttempt } from "@/lib/services/whatsappCampaigns/types";

export interface MessageAttemptDocument extends Document {
  messageId: Types.ObjectId;
  attemptNumber: number;
  status: string;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  attemptedAt: Date;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
}

const messageAttemptSchema = new Schema<MessageAttemptDocument>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    attemptNumber: { type: Number, required: true },
    status: { type: String, enum: ["success", "failure"], required: true },
    providerMessageId: { type: String },
    errorCode: { type: String },
    errorMessage: { type: String },
    attemptedAt: { type: Date, required: true, default: Date.now },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// "Every attempt for this message, in order" — the diagnostics view
// this model exists for.
messageAttemptSchema.index({ messageId: 1, attemptNumber: 1 });

messageAttemptSchema.plugin(tenantScopePlugin);

export function toMessageAttempt(doc: MessageAttemptDocument): MessageAttempt {
  return {
    id: doc._id.toString(),
    messageId: doc.messageId.toString(),
    attemptNumber: doc.attemptNumber,
    status: doc.status as MessageAttempt["status"],
    providerMessageId: doc.providerMessageId,
    errorCode: doc.errorCode,
    errorMessage: doc.errorMessage,
    attemptedAt: doc.attemptedAt.toISOString(),
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export const MessageAttemptModel: Model<MessageAttemptDocument> =
  (models.MessageAttempt as Model<MessageAttemptDocument>) ||
  model<MessageAttemptDocument>("MessageAttempt", messageAttemptSchema);

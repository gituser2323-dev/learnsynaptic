import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Message } from "@/lib/services/whatsappCampaigns/types";

export interface MessageDocument extends Document {
  campaignId?: Types.ObjectId;
  recipientPhoneE164?: string;
  recipientEmail?: string;
  recipientName?: string;
  leadId?: Types.ObjectId;
  registrationId?: Types.ObjectId;
  templateId?: string;
  workflowRunId?: Types.ObjectId;
  subject?: string;
  conversationId?: Types.ObjectId;
  direction?: string;
  body?: string;
  messageType?: string;
  mediaId?: string;
  mediaMimeType?: string;
  mediaUrl?: string;
  interactivePayload?: Record<string, unknown>;
  status: string;
  provider?: string;
  providerMessageId?: string;
  failureReason?: string;
  attempts: number;
  queuedAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageDocument>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "WhatsAppCampaign" },
    // Module 4.2 — neither is `required` at the schema level anymore;
    // exactly one is set depending on the message's channel, enforced
    // by the service layer (conversationService), the same posture
    // conversation.model.ts's own contactPhoneE164/contactEmail split
    // just took.
    recipientPhoneE164: { type: String, trim: true },
    recipientEmail: { type: String, trim: true, lowercase: true },
    recipientName: { type: String, trim: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    registrationId: { type: Schema.Types.ObjectId, ref: "Registration" },
    // A free-form identifier, NOT a CampaignTemplate ref — the Campaign
    // Manager's own bulk sends and the Automation Engine's ad-hoc
    // template sends (Module 3.1's send_whatsapp_template action) both
    // write here, and only the former ever corresponds to a real
    // CampaignTemplate document; the latter is a literal vendor-side
    // template name (e.g. "lead_welcome_v1"). Found live: an ObjectId
    // schema type here made every automation-triggered send throw a
    // cast error before this fix, since it's always been a plain string
    // at the domain-type level (see Message.templateId in
    // lib/services/whatsappCampaigns/types.ts) — the schema had simply
    // never matched the domain type.
    templateId: { type: String },
    // Enterprise Analytics (Phase 7), module 7.2 — set only by the
    // automation engine's own send_whatsapp_template/send_email
    // executors, never by a manual compose reply or a WhatsAppCampaign
    // bulk send. See Message.workflowRunId's own doc comment.
    workflowRunId: { type: Schema.Types.ObjectId, ref: "WorkflowRun" },
    // Module 4.2 — an email's subject line. Unset for WhatsApp messages.
    subject: { type: String, trim: true, maxlength: 300 },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation" },
    direction: { type: String, enum: ["inbound", "outbound"], default: "outbound" },
    body: { type: String, maxlength: 4096 },
    messageType: {
      type: String,
      enum: [
        "text",
        "image",
        "video",
        "audio",
        "document",
        "location",
        "contacts",
        "interactive_button",
        "interactive_list",
        "button_reply",
        "list_reply",
        "reaction",
        "email",
      ],
      default: "text",
    },
    mediaId: { type: String },
    mediaMimeType: { type: String },
    mediaUrl: { type: String },
    interactivePayload: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "delivered", "read", "failed"],
      default: "queued",
    },
    provider: { type: String },
    providerMessageId: { type: String },
    failureReason: { type: String },
    attempts: { type: Number, default: 0 },
    queuedAt: { type: Date, required: true, default: Date.now },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    failedAt: { type: Date },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// Analytics: "for this campaign, count by status" — every Delivery/Read/
// Failed Analytics query and the denormalized-rollup cross-check.
messageSchema.index({ campaignId: 1, status: 1 });
// The webhook's own lookup-and-update path — the single most frequent
// query against this collection once volume is real.
messageSchema.index({ providerMessageId: 1 });
// WhatsApp Platform (Phase 2) — the unified thread view's own query:
// every message in one conversation, chronological.
messageSchema.index({ conversationId: 1, createdAt: 1 });
// Enterprise Analytics (Phase 7), module 7.2 — "how many messages did
// this workflow send" and date-range-scoped automation analytics.
messageSchema.index({ workflowRunId: 1 });
messageSchema.index({ createdAt: -1 });

messageSchema.plugin(tenantScopePlugin);

export function toMessage(doc: MessageDocument): Message {
  return {
    id: doc._id.toString(),
    campaignId: doc.campaignId?.toString(),
    recipientPhoneE164: doc.recipientPhoneE164,
    recipientEmail: doc.recipientEmail,
    recipientName: doc.recipientName,
    leadId: doc.leadId?.toString(),
    registrationId: doc.registrationId?.toString(),
    templateId: doc.templateId?.toString(),
    workflowRunId: doc.workflowRunId?.toString(),
    subject: doc.subject,
    conversationId: doc.conversationId?.toString(),
    direction: doc.direction as Message["direction"],
    body: doc.body,
    messageType: doc.messageType as Message["messageType"],
    mediaId: doc.mediaId,
    mediaMimeType: doc.mediaMimeType,
    mediaUrl: doc.mediaUrl,
    interactivePayload: doc.interactivePayload,
    status: doc.status as Message["status"],
    provider: doc.provider as Message["provider"],
    providerMessageId: doc.providerMessageId,
    failureReason: doc.failureReason,
    attempts: doc.attempts,
    queuedAt: doc.queuedAt.toISOString(),
    sentAt: doc.sentAt?.toISOString(),
    deliveredAt: doc.deliveredAt?.toISOString(),
    readAt: doc.readAt?.toISOString(),
    failedAt: doc.failedAt?.toISOString(),
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const MessageModel: Model<MessageDocument> =
  (models.Message as Model<MessageDocument>) || model<MessageDocument>("Message", messageSchema);

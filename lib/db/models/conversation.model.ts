import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Conversation } from "@/lib/services/conversations/types";

export interface ConversationDocument extends Document {
  channel: string;
  contactPhoneE164?: string;
  contactEmail?: string;
  contactName?: string;
  leadId?: Types.ObjectId;
  status: string;
  assignedTo?: Types.ObjectId;
  labels: string[];
  lastMessageAt: Date;
  lastMessagePreview?: string;
  lastMessageDirection?: string;
  lastInboundSubject?: string;
  unreadCount: number;
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDocument>(
  {
    channel: { type: String, enum: ["whatsapp", "email"], required: true, default: "whatsapp" },
    // Both optional at the schema level now (module 4.2) — exactly one
    // is set depending on `channel`, enforced by the service layer
    // (conversationService.getOrCreateForContact vs.
    // getOrCreateForEmailContact), not by a schema-level conditional
    // required (Mongoose's own required-if support is awkward enough
    // that every other conditional-by-type field in this codebase, e.g.
    // WorkflowActionSpec.params, is validated in the service layer too).
    contactPhoneE164: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactName: { type: String, trim: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    status: { type: String, enum: ["open", "closed"], required: true, default: "open" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    labels: { type: [String], default: [] },
    lastMessageAt: { type: Date, required: true, default: Date.now },
    lastMessagePreview: { type: String, trim: true, maxlength: 300 },
    lastMessageDirection: { type: String, enum: ["inbound", "outbound"] },
    lastInboundSubject: { type: String, trim: true, maxlength: 300 },
    unreadCount: { type: Number, default: 0 },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// One conversation per (contact, channel) — the identity
// getOrCreateForContact() resolves against on every inbound/outbound
// WhatsApp message. A PARTIAL index with an explicit $exists filter,
// not `sparse: true` — found live, the hard way, while migrating this
// index on the real deployment: MongoDB's `sparse` on a COMPOUND index
// only excludes a document when EVERY indexed field is absent, not
// when just one is. Since `channel` is always present on every
// Conversation, `sparse: true` here would have excluded nothing at
// all — every WhatsApp conversation missing contactEmail (all of them,
// pre-4.2) collided on the same implicit `{contactEmail: null,
// channel: "whatsapp"}` the instant the mirror index below was built,
// which is exactly what happened rebuilding this index against the
// real dataset. A partialFilterExpression targets the one field that
// actually needs to be optional, which is what this index needed.
// Business OS Phase 8, Module 8.1 — organizationId leads both compound
// indexes below: two organizations' contacts could coincidentally
// share a phone/email (or, once Module 8.2 gives each org its own real
// WhatsApp/email connection, routinely will), and the pre-8.1 index
// would have wrongly treated that as the same Conversation. Real
// impact is currently theoretical (this deployment has exactly one
// connected WhatsApp/email account today — see webhookDelivery.model.ts's
// own doc comment on that same single-connection reality) but the
// index's own correctness shouldn't wait for 8.2 to matter.
conversationSchema.index(
  { organizationId: 1, contactPhoneE164: 1, channel: 1 },
  { unique: true, partialFilterExpression: { contactPhoneE164: { $exists: true } } },
);
// Module 4.2 — the same identity shape for email, resolved against by
// getOrCreateForEmailContact(). Same partial-index reasoning as above,
// mirrored for the other optional identity field.
conversationSchema.index(
  { organizationId: 1, contactEmail: 1, channel: 1 },
  { unique: true, partialFilterExpression: { contactEmail: { $exists: true } } },
);
// The inbox's own query shape: "my open conversations," reverse-
// chronological.
conversationSchema.index({ assignedTo: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ status: 1, lastMessageAt: -1 });

conversationSchema.plugin(tenantScopePlugin);

export function toConversation(doc: ConversationDocument): Conversation {
  return {
    id: doc._id.toString(),
    channel: doc.channel as Conversation["channel"],
    contactPhoneE164: doc.contactPhoneE164,
    contactEmail: doc.contactEmail,
    contactName: doc.contactName,
    leadId: doc.leadId?.toString(),
    status: doc.status as Conversation["status"],
    assignedTo: doc.assignedTo?.toString(),
    labels: doc.labels,
    lastMessageAt: doc.lastMessageAt.toISOString(),
    lastMessagePreview: doc.lastMessagePreview,
    lastMessageDirection: doc.lastMessageDirection as Conversation["lastMessageDirection"],
    lastInboundSubject: doc.lastInboundSubject,
    unreadCount: doc.unreadCount,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const ConversationModel: Model<ConversationDocument> =
  (models.Conversation as Model<ConversationDocument>) ||
  model<ConversationDocument>("Conversation", conversationSchema);

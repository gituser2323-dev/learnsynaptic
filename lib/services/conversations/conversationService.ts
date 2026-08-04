import { getConversationRepository, getMessageRepository, getLeadRepository, getWhatsAppCampaignRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { activityService } from "@/lib/services/crm/activities";
import { publish } from "@/lib/events";
import { whatsappService } from "@/lib/services/whatsapp";
import { emailService } from "@/lib/services/email";
import type { AuditContext } from "@/lib/services/auditLog";
import type { Activity } from "@/lib/services/crm/activities";
import type { Message } from "@/lib/services/whatsappCampaigns";
import type { WhatsAppInboundMessage, WhatsAppSendResult, MessageContentType, WhatsAppMediaKind } from "@/lib/services/whatsapp";
import type { EmailInboundMessage, EmailSendResult } from "@/lib/services/email";
import type {
  Conversation,
  ConversationChannel,
  ConversationListFilters,
  MessageDirection,
  SendReplyInput,
} from "./types";
import type { PaginatedResult } from "@/lib/pagination";

const PREVIEW_MAX_LENGTH = 120;

/** Module 2.2 — a well-formed reply that the active WhatsApp provider
 *  itself rejected or failed to deliver (as opposed to
 *  WhatsAppProviderNotImplementedError, which means the provider never
 *  attempted it at all). Kept local to this module rather than a
 *  lib/api ApiError subclass — services in this codebase stay
 *  framework-agnostic; the API route layer is what translates a thrown
 *  error into an HTTP response (see every existing admin route's own
 *  try/throw-ValidationApiError pattern). */
export class ConversationSendFailedError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ConversationSendFailedError";
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Outbound media fallback preview text when the admin sends without a
 *  caption — mirrors describeInboundContent's own fallbacks in the Meta
 *  provider, kept in sync manually since one is inbound-only vendor
 *  parsing and this is outbound-only reply composition. */
const MEDIA_KIND_FALLBACK_BODY: Record<WhatsAppMediaKind, string> = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎤 Voice message",
  document: "📄 Document",
};

/** Module 4.2 (Email Channel) — the email-send half of sendReply's
 *  "text" case, split out as a module-level helper the same way
 *  bumpLastMessage/truncate already are, not a second object method:
 *  it's an internal step of sendReply, not part of this module's public
 *  surface. Synthesizes a "Re: {subject}" line from
 *  Conversation.lastInboundSubject rather than requiring the compose UI
 *  to author a subject — see that field's own doc comment. Falls back
 *  to a generic subject for the (unlikely) case of an admin-initiated
 *  reply on a conversation with no inbound message yet. */
async function sendEmailReply(conversation: Conversation, body: string): Promise<Message> {
  const subject = conversation.lastInboundSubject ? `Re: ${conversation.lastInboundSubject}` : "Re: your message";
  const result: EmailSendResult = await emailService.sendEmail(
    { email: conversation.contactEmail as string, name: conversation.contactName },
    { subject, bodyText: body },
  );
  if (!result.success) {
    throw new ConversationSendFailedError(result.error.message, result.error.code, result.error.retryable);
  }

  const messageRepository = await getMessageRepository();
  const message = await messageRepository.create({
    recipientEmail: conversation.contactEmail,
    recipientName: conversation.contactName,
    conversationId: conversation.id,
    direction: "outbound",
    body,
    subject,
    messageType: "email",
  });
  const sentAt = new Date().toISOString();
  await messageRepository.update(message.id, { status: "sent", providerMessageId: result.providerMessageId, sentAt });
  await bumpLastMessage(conversation.id, body, "outbound", 0);
  return { ...message, status: "sent", providerMessageId: result.providerMessageId, sentAt };
}

/**
 * WhatsApp Platform (Phase 2), Module 2.5 — Campaign Enhancements'
 * reply/click-rate tracking. Best-effort and silent on no-match: most
 * inbound messages are not a reply to a campaign send at all (a fresh
 * lead reaching out first, a reply to a manual admin message, an
 * Auto-Reply loop), and `findLatestOutboundCampaignMessage` correctly
 * returns null for all of those — this is not an error path, just the
 * common case. A `button_reply`/`list_reply` messageType additionally
 * counts as a "click," the closest real signal WhatsApp exposes to a
 * button/list tap without Meta's own separate URL-click analytics API.
 */
async function attributeInboundMessageToCampaign(
  recipientPhoneE164: string,
  messageType: MessageContentType,
): Promise<void> {
  const messageRepository = await getMessageRepository();
  const lastCampaignMessage = await messageRepository.findLatestOutboundCampaignMessage(recipientPhoneE164);
  if (!lastCampaignMessage?.campaignId) return;

  const campaignRepository = await getWhatsAppCampaignRepository();
  const isClick = messageType === "button_reply" || messageType === "list_reply";
  await campaignRepository.incrementCounts(lastCampaignMessage.campaignId, {
    replyCount: 1,
    ...(isClick ? { clickCount: 1 } : {}),
  });
}

async function bumpLastMessage(
  conversationId: string,
  body: string | undefined,
  direction: MessageDirection,
  extraUnread: number,
): Promise<void> {
  const repository = await getConversationRepository();
  const conversation = await repository.findById(conversationId);
  await repository.update(conversationId, {
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: body ? truncate(body, PREVIEW_MAX_LENGTH) : undefined,
    lastMessageDirection: direction,
    unreadCount: (conversation?.unreadCount ?? 0) + extraUnread,
  });
}

export const conversationService = {
  /** Idempotent — the repository's own create() upserts on
   *  (contactPhoneE164, channel), so calling this twice for the same
   *  contact returns the same row rather than erroring or duplicating. */
  async getOrCreateForContact(
    contactPhoneE164: string,
    channel: ConversationChannel,
    contactName?: string,
  ): Promise<Conversation> {
    const repository = await getConversationRepository();
    const existing = await repository.findByContact(contactPhoneE164, channel);
    if (existing) {
      // A name arriving later (e.g. the profile name on an inbound
      // message) fills in a conversation that was first created without
      // one — never overwrites a name that's already set.
      if (contactName && !existing.contactName) {
        return repository.update(existing.id, { contactName });
      }
      return existing;
    }
    return repository.create({ contactPhoneE164, channel, contactName });
  },

  /** Module 4.2 (Email Channel) — the email-identity equivalent of
   *  getOrCreateForContact above. Kept as a separate method rather than
   *  adding a channel branch inside that one: the two identity fields
   *  (contactPhoneE164/contactEmail) are genuinely different lookups
   *  against different repository methods and different sparse unique
   *  indexes, not a single parameterized query. Always channel:
   *  "email" — there's no equivalent ambiguity WhatsApp's version needs
   *  a channel parameter for. */
  async getOrCreateForEmailContact(contactEmail: string, contactName?: string): Promise<Conversation> {
    const repository = await getConversationRepository();
    const existing = await repository.findByEmailContact(contactEmail, "email");
    if (existing) {
      if (contactName && !existing.contactName) {
        return repository.update(existing.id, { contactName });
      }
      return existing;
    }
    return repository.create({ contactEmail, channel: "email", contactName });
  },

  /** The one new capability this module adds that didn't exist before
   *  at all: a contact's reply becomes a real Message row (not just a
   *  logged webhook event) and the trigger 3.3 (Auto-Reply) will
   *  eventually subscribe to. No subscriber exists yet — publishing
   *  now, unused, is the same "build the seam before the thing that
   *  needs it" call 1.3's ScoringProvider interface already made for
   *  5.1.
   *
   *  Module 2.2 (Rich Messaging) — takes the full normalized
   *  WhatsAppInboundMessage (every content type, not just text) rather
   *  than a narrow {body, providerMessageId} shape; the webhook route
   *  now just spreads what the provider already parsed. For media
   *  (image/video/audio/document), the row is created first so its own
   *  id exists, then patched with `mediaUrl` pointing at this app's own
   *  proxy route — see that route's doc comment on why inbound media
   *  isn't durably re-hosted. */
  async recordInboundMessage(
    input: WhatsAppInboundMessage & { channel: ConversationChannel },
  ): Promise<{ conversation: Conversation; message: Message }> {
    const conversation = await this.getOrCreateForContact(input.fromPhoneE164, input.channel, input.contactName);

    const messageRepository = await getMessageRepository();
    const message = await messageRepository.create({
      recipientPhoneE164: input.fromPhoneE164,
      recipientName: input.contactName,
      conversationId: conversation.id,
      direction: "inbound",
      body: input.body,
      messageType: input.messageType,
      mediaId: input.mediaId,
      mediaMimeType: input.mediaMimeType,
      interactivePayload: input.interactivePayload,
    });

    // Inbound has no send lifecycle of its own — "delivered" is the
    // closest existing status to "this message reached us," without
    // adding a parallel status enum just for direction. Media gets a
    // second field set here too: mediaUrl can only be computed once
    // message.id exists (it's this app's own proxy path, not Meta's).
    await messageRepository.update(message.id, {
      status: "delivered",
      providerMessageId: input.providerMessageId,
      ...(input.mediaId ? { mediaUrl: `/api/admin/conversations/media/${message.id}` } : {}),
    });

    await bumpLastMessage(conversation.id, input.body, "inbound", 1);

    // Module 2.5 — reply/click attribution, silent no-op for the
    // common case (this contact never received a campaign message).
    await attributeInboundMessageToCampaign(input.fromPhoneE164, input.messageType);

    // Opportunistic Lead link — never overwrites one a human already
    // set (see leadId in UpdateConversationInput's own comment on
    // conversationId being a pointer, same reasoning here in reverse).
    if (!conversation.leadId) {
      const leadRepository = await getLeadRepository();
      const lead = await leadRepository.findByPhoneOrEmail(input.fromPhoneE164, "");
      if (lead) {
        const repository = await getConversationRepository();
        await repository.update(conversation.id, { leadId: lead.id });
      }
    }

    await publish("message.received", {
      conversationId: conversation.id,
      messageId: message.id,
      contactPhoneE164: input.fromPhoneE164,
      body: input.body,
    });

    return {
      conversation,
      message: {
        ...message,
        status: "delivered",
        ...(input.mediaId ? { mediaUrl: `/api/admin/conversations/media/${message.id}` } : {}),
      },
    };
  },

  /** Module 4.2 (Email Channel) — the email-inbound equivalent of
   *  recordInboundMessage above. A separate method rather than a
   *  channel branch inside that one: the input shape genuinely differs
   *  (EmailInboundMessage has no messageType/mediaId/interactivePayload
   *  — email is always subject+body, the same "not every channel needs
   *  the same shape" call module 3.3's Auto-Reply Engine already made
   *  about not sharing machinery with 3.1's WorkflowDefinition engine),
   *  and identity resolution goes through getOrCreateForEmailContact,
   *  not getOrCreateForContact. Sets Conversation.lastInboundSubject so
   *  sendReply's email branch can synthesize a "Re: {subject}" line
   *  without a second query. */
  async recordInboundEmailMessage(input: EmailInboundMessage): Promise<{ conversation: Conversation; message: Message }> {
    const conversation = await this.getOrCreateForEmailContact(input.fromEmail, input.fromName);

    const messageRepository = await getMessageRepository();
    const message = await messageRepository.create({
      recipientEmail: input.fromEmail,
      recipientName: input.fromName,
      conversationId: conversation.id,
      direction: "inbound",
      body: input.bodyText,
      subject: input.subject,
      messageType: "email",
    });

    await messageRepository.update(message.id, { status: "delivered", providerMessageId: input.providerMessageId });

    const repository = await getConversationRepository();
    await repository.update(conversation.id, { lastInboundSubject: input.subject });
    await bumpLastMessage(conversation.id, input.bodyText, "inbound", 1);

    // Opportunistic Lead link — same "never overwrite a human-set
    // leadId" reasoning as recordInboundMessage's own WhatsApp version.
    if (!conversation.leadId) {
      const leadRepository = await getLeadRepository();
      const lead = await leadRepository.findByPhoneOrEmail("", input.fromEmail);
      if (lead) {
        await repository.update(conversation.id, { leadId: lead.id });
      }
    }

    await publish("message.received", {
      conversationId: conversation.id,
      messageId: message.id,
      contactEmail: input.fromEmail,
      body: input.bodyText,
    });

    // Re-fetch rather than returning the `conversation` snapshot
    // captured before this method's own writes above (lastInboundSubject,
    // bumpLastMessage, the opportunistic lead link) — found live during
    // this module's own verification pass: the snapshot was stale by
    // the time it reached the caller, silently missing fields this
    // very function had just set. `publish()` awaits module 3.3's
    // Auto-Reply Engine synchronously, so this can also reflect an
    // auto-reply's own outbound bump on top — the true current state,
    // not a lie either way.
    const freshConversation = (await repository.findById(conversation.id)) ?? conversation;
    return { conversation: freshConversation, message: { ...message, status: "delivered" } };
  },

  /** Module 2.2 (Rich Messaging) — sends a reply from the thread view
   *  (text, interactive buttons, interactive list, or media-by-URL) and
   *  records it as an outbound Message the same way a campaign send
   *  already does. Returns `null` if the conversation doesn't exist —
   *  same "null means not found, let the caller 404" convention as
   *  getThread(). Throws WhatsAppProviderNotImplementedError if the
   *  active provider hasn't wired up this send type (bubbled straight
   *  from whatsappService), or ConversationSendFailedError if the
   *  provider attempted the send and it was rejected/failed.
   *
   *  Module 4.2 (Email Channel) — the "text" case is now channel-aware:
   *  an email conversation routes through sendEmailReply/emailService
   *  instead of whatsappService, keyed on conversation.channel, not on
   *  a separate SendReplyInput variant the caller has to pick. This is
   *  a deliberate design choice, not the minimal one: module 3.3's
   *  Auto-Reply Engine already calls this method with exactly
   *  `{type: "text", body}` and has no channel awareness of its own —
   *  making "text" channel-aware here means Auto-Reply now replies
   *  correctly on email conversations too, with zero changes to
   *  autoReplyService. buttons/list/media stay WhatsApp-only send
   *  types (no email equivalent — see SendReplyInput's own doc
   *  comment); calling one of those against an email conversation is
   *  rejected explicitly rather than silently misrouted through
   *  whatsappService with an undefined phone number. */
  async sendReply(conversationId: string, input: SendReplyInput): Promise<Message | null> {
    const repository = await getConversationRepository();
    const conversation = await repository.findById(conversationId);
    if (!conversation) return null;

    if (conversation.channel === "email") {
      if (input.type !== "text") {
        throw new ConversationSendFailedError(
          "This conversation is on the email channel — only a plain text reply is supported (buttons/list/media are WhatsApp-only).",
          "unsupported_send_type_for_channel",
          false,
        );
      }
      return sendEmailReply(conversation, input.body);
    }

    const recipient = { phoneE164: conversation.contactPhoneE164 as string, name: conversation.contactName };

    let result: WhatsAppSendResult;
    let messageType: MessageContentType;
    let body: string;
    let interactivePayload: Record<string, unknown> | undefined;
    let mediaUrl: string | undefined;

    switch (input.type) {
      case "text":
        result = await whatsappService.sendPlainText(recipient, input.body);
        messageType = "text";
        body = input.body;
        break;
      case "buttons":
        result = await whatsappService.sendInteractiveButtonsMessage(recipient, input.bodyText, input.buttons);
        messageType = "interactive_button";
        body = input.bodyText;
        interactivePayload = { buttons: input.buttons };
        break;
      case "list":
        result = await whatsappService.sendInteractiveListMessage(
          recipient,
          input.bodyText,
          input.buttonText,
          input.sections,
        );
        messageType = "interactive_list";
        body = input.bodyText;
        interactivePayload = { buttonText: input.buttonText, sections: input.sections };
        break;
      case "media":
        result = await whatsappService.sendMediaMessage(recipient, {
          kind: input.kind,
          url: input.url,
          caption: input.caption,
          filename: input.filename,
        });
        messageType = input.kind;
        body = input.caption || MEDIA_KIND_FALLBACK_BODY[input.kind];
        mediaUrl = input.url;
        break;
    }

    if (!result.success) {
      throw new ConversationSendFailedError(result.error.message, result.error.code, result.error.retryable);
    }

    const messageRepository = await getMessageRepository();
    const message = await messageRepository.create({
      recipientPhoneE164: conversation.contactPhoneE164,
      recipientName: conversation.contactName,
      conversationId: conversation.id,
      direction: "outbound",
      body,
      messageType,
      mediaUrl,
      interactivePayload,
    });
    const sentAt = new Date().toISOString();
    await messageRepository.update(message.id, { status: "sent", providerMessageId: result.providerMessageId, sentAt });

    await bumpLastMessage(conversation.id, body, "outbound", 0);

    return { ...message, status: "sent", providerMessageId: result.providerMessageId, sentAt };
  },

  /** Called after a campaign (or any future direct) send succeeds —
   *  links the just-created outbound Message into its Conversation.
   *  `body` is a synthesized display string (see Message.body's own
   *  comment on why it's never a reconstruction of rendered template
   *  variables). */
  async linkOutboundMessage(
    messageId: string,
    contactPhoneE164: string,
    channel: ConversationChannel,
    body: string,
  ): Promise<void> {
    const conversation = await this.getOrCreateForContact(contactPhoneE164, channel);
    const messageRepository = await getMessageRepository();
    await messageRepository.update(messageId, { conversationId: conversation.id, direction: "outbound", body });
    await bumpLastMessage(conversation.id, body, "outbound", 0);
  },

  async assign(id: string, userId: string, context: AuditContext = {}): Promise<Conversation> {
    const repository = await getConversationRepository();
    const updated = await repository.update(id, { assignedTo: userId });
    await auditLogService.record({
      action: AUDIT_ACTIONS.CONVERSATION_ASSIGNED,
      entityType: "Conversation",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { assignedTo: userId },
    });
    await activityService.logSystemEvent("Conversation", id, "Assigned to a counsellor");
    return updated;
  },

  async setLabels(id: string, labels: string[], context: AuditContext = {}): Promise<Conversation> {
    const repository = await getConversationRepository();
    const updated = await repository.update(id, { labels });
    await auditLogService.record({
      action: AUDIT_ACTIONS.CONVERSATION_LABELED,
      entityType: "Conversation",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { labels },
    });
    return updated;
  },

  async setStatus(id: string, status: Conversation["status"]): Promise<Conversation> {
    const repository = await getConversationRepository();
    const updated = await repository.update(id, { status });
    await activityService.logSystemEvent("Conversation", id, status === "closed" ? "Conversation closed" : "Conversation reopened");
    return updated;
  },

  async addInternalNote(id: string, body: string, actorId?: string): Promise<Activity> {
    return activityService.logActivity({ entityType: "Conversation", entityId: id, type: "note", body, actorId });
  },

  async listConversations(
    filters: ConversationListFilters,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Conversation>> {
    const repository = await getConversationRepository();
    return repository.list(filters, page, limit);
  },

  /** The thread view's one read: the conversation record, every Message
   *  in it (oldest first — a chat reads top-to-bottom, the opposite
   *  order from Activity's own reverse-chronological timeline), and the
   *  Activity feed (internal notes + system events) for the same
   *  entity. Marks the conversation read as a deliberate side effect —
   *  opening a thread *is* "I've seen this" in an inbox, the same
   *  reasoning a notification's own "mark read" action normally needs
   *  a separate explicit call, except here the read action and the view
   *  action are the same user gesture. */
  async getThread(
    id: string,
  ): Promise<{ conversation: Conversation; messages: Message[]; activities: Activity[] } | null> {
    const repository = await getConversationRepository();
    const conversation = await repository.findById(id);
    if (!conversation) return null;

    const messageRepository = await getMessageRepository();
    const [messagesPage, activitiesPage] = await Promise.all([
      messageRepository.list({ conversationId: id }, 1, 500),
      activityService.listTimeline({ entityType: "Conversation", entityId: id }, 1, 200),
    ]);

    if (conversation.unreadCount > 0) {
      await repository.update(id, { unreadCount: 0 });
    }

    return {
      conversation: { ...conversation, unreadCount: 0 },
      messages: messagesPage.items.slice().reverse(),
      activities: activitiesPage.items,
    };
  },
};

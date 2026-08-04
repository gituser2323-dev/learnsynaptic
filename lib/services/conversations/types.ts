import type { PaginatedResult } from "@/lib/pagination";
import type { MessageDirection } from "@/lib/services/whatsappCampaigns/types";
import type { WhatsAppQuickReplyButton, WhatsAppListSection, WhatsAppMediaKind } from "@/lib/services/whatsapp";

/**
 * Conversation domain layer — WhatsApp Platform (Phase 2), module 2.1.
 *
 * One Conversation per (contact, channel) pair — "see a contact's whole
 * WhatsApp history as one thread, not one row per campaign send." A
 * Message optionally links to a Conversation via `conversationId` (see
 * lib/services/whatsappCampaigns' Message type); Conversation itself
 * never embeds messages, the same "top-level, independently queried"
 * shape Opportunity already uses relative to Pipeline.
 *
 * `channel` included `"email"` from day one, before Phase 4 existed —
 * module 4.2 (Email Channel Integration) is what actually reads/writes
 * an email Conversation now, reusing this exact entity rather than
 * inventing a second "Thread" concept, per the approved Blueprint's own
 * resolved-conflicts note. `contactPhoneE164` was WhatsApp's own
 * required identity field; 4.2 added `contactEmail` alongside it
 * (both optional now) rather than renaming/generalizing, so this
 * really was additive, not a migration.
 */

export type ConversationChannel = "whatsapp" | "email";
export type ConversationStatus = "open" | "closed";
export type { MessageDirection };

export interface Conversation {
  id: string;
  channel: ConversationChannel;
  /** Required for channel: "whatsapp", unset for channel: "email" — see
   *  contactEmail below. Two separate optional fields rather than one
   *  generalized "contactIdentifier" string: keeping this field's name
   *  and every existing WhatsApp call site untouched (module 4.2 is
   *  additive, the same "email exists purely so this is additive" call
   *  this file's own top doc comment already made for `channel`). */
  contactPhoneE164?: string;
  /** Module 4.2 (Email Channel) — required for channel: "email", unset
   *  for channel: "whatsapp". */
  contactEmail?: string;
  contactName?: string;
  /** Set when the contact's phone/email resolves to a known Lead — a
   *  pointer only, never a copy of Lead fields. */
  leadId?: string;
  status: ConversationStatus;
  /** A User id (counsellor/manager/admin). */
  assignedTo?: string;
  labels: string[];
  /** Denormalized rollup for the inbox list — the same "avoid per-row
   *  aggregation on a paginated list" pattern lib/services/marketing and
   *  WhatsAppCampaign's own send counters already use. Recomputed from
   *  the real Message row on every inbound/outbound write, never
   *  hand-edited. */
  lastMessageAt: string;
  lastMessagePreview?: string;
  lastMessageDirection?: MessageDirection;
  /** Module 4.2 — the most recent *inbound* email's subject, so a reply
   *  can be synthesized as "Re: {subject}" without a separate query
   *  against Message. Same denormalized-for-a-read-path shape as
   *  lastMessagePreview, just channel-specific: unset for WhatsApp
   *  conversations, which have no subject concept. */
  lastInboundSubject?: string;
  /** Inbound messages since the conversation was last opened/read;
   *  reset to 0 by the thread-view GET (marking it read), incremented
   *  by every inbound message. */
  unreadCount: number;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversationInput {
  channel: ConversationChannel;
  contactPhoneE164?: string;
  contactEmail?: string;
  contactName?: string;
  leadId?: string;
  organizationId?: string;
}

export interface UpdateConversationInput {
  contactName?: string;
  leadId?: string;
  status?: ConversationStatus;
  assignedTo?: string;
  labels?: string[];
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageDirection?: MessageDirection;
  lastInboundSubject?: string;
  unreadCount?: number;
}

export interface ConversationListFilters {
  channel?: ConversationChannel;
  status?: ConversationStatus;
  assignedTo?: string;
  label?: string;
  /** Case-insensitive match against contact name, phone, or email. */
  search?: string;
  /** AI CRM (Phase 5), Module 5.1 — leadInsightService's own lookup:
   *  find this lead's conversation(s) to pull recent message context
   *  from. */
  leadId?: string;
}

/** Module 2.2 (Rich Messaging) — every shape a reply from the thread
 *  view can take. A discriminated union rather than one interface with
 *  every field optional: it's the caller (the compose UI) that already
 *  knows which mode it's in, and this makes an invalid combination (a
 *  "media" reply with `sections`, say) impossible to construct instead
 *  of merely undocumented. */
export type SendReplyInput =
  | { type: "text"; body: string }
  | { type: "buttons"; bodyText: string; buttons: WhatsAppQuickReplyButton[] }
  | { type: "list"; bodyText: string; buttonText: string; sections: WhatsAppListSection[] }
  | { type: "media"; kind: WhatsAppMediaKind; url: string; caption?: string; filename?: string };

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByContact(contactPhoneE164: string, channel: ConversationChannel): Promise<Conversation | null>;
  /** Module 4.2 (Email Channel) — the email-identity equivalent of
   *  findByContact, kept as a separate method rather than generalizing
   *  findByContact's signature: every existing WhatsApp call site stays
   *  untouched (see this file's own top doc comment on why
   *  contactPhoneE164/contactEmail are two fields, not one). */
  findByEmailContact(contactEmail: string, channel: ConversationChannel): Promise<Conversation | null>;
  create(input: CreateConversationInput): Promise<Conversation>;
  update(id: string, input: UpdateConversationInput): Promise<Conversation>;
  /** Reverse-chronological by lastMessageAt — the inbox's own read
   *  pattern, same convention Activity's timeline already documents for
   *  its own reverse-chronological listing. */
  list(filters: ConversationListFilters, page: number, limit: number): Promise<PaginatedResult<Conversation>>;
}

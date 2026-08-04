import type { ClientSession } from "mongoose";
import type { PaginatedResult } from "@/lib/pagination";
import type { LeadListFilters } from "@/lib/services/leads";
import type { WhatsAppProviderId, MessageContentType } from "@/lib/services/whatsapp";
import type { EmailProviderId } from "@/lib/services/email";

/**
 * WhatsApp Campaign Manager domain layer (CAMPAIGN_ARCHITECTURE.md).
 *
 * Deliberately a separate bounded context from lib/services/campaigns
 * (marketing/UTM attribution) — see that document's §1 for the full
 * reasoning. `WhatsAppCampaign.marketingCampaignId` is the only
 * connection between the two, optional, for attribution reporting only.
 *
 * Four entities:
 *  - WhatsAppCampaign: the campaign itself — status, audience source,
 *    schedule, denormalized rollup counters.
 *  - CampaignTemplate: a thin, reusable reference to a Meta-approved
 *    template — does not duplicate WhatsAppTemplatePayload or change
 *    how a send actually happens.
 *  - Message: current delivery state, one row per recipient per
 *    campaign — also the unit the shared job queue schedules against
 *    (lib/services/scheduler) and the unit "Retry Failed" operates on.
 *  - MessageAttempt: immutable historical log, one row per actual send
 *    attempt — Message is "where things stand now," MessageAttempt is
 *    "everything that happened," per the approved design decision.
 */

// ─── WhatsAppCampaign ────────────────────────────────────────────────────

export type WhatsAppCampaignStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "sending"
  | "completed"
  | "failed"
  | "cancelled";

export type AudienceSource = "filter" | "csv_import" | "manual";

/** Module 2.5 — Campaign Enhancements. Deliberately minimal: no stored
 *  audience-resolution "recipe" exists anywhere in this architecture
 *  (`audienceSource` is just a tag, never the actual `LeadListFilters`/
 *  recipient list used) — see `checkCampaignCompletion`'s own doc
 *  comment for why recurrence therefore auto-creates the next
 *  occurrence as a fresh draft, not a fully unattended re-send. */
export interface CampaignRecurrenceRule {
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  status: WhatsAppCampaignStatus;
  templateId: string;
  audienceSource?: AudienceSource;
  /** Set once the audience is resolved into Message rows (draft ->
   *  ready). Never re-queried live afterward — see
   *  CAMPAIGN_ARCHITECTURE.md §5 for why a snapshot, not a live query. */
  audienceSnapshotAt?: string;
  scheduledFor?: string;
  /** Optional cross-reference to the *unrelated* marketing Campaign
   *  entity (lib/services/campaigns), for attribution reporting only. */
  marketingCampaignId?: string;
  recipientCount: number;
  /** Denormalized rollups, updated incrementally as Message rows change
   *  status — see CAMPAIGN_ARCHITECTURE.md §9 (mirrors the existing
   *  Campaign.registrationCount precedent). Exact per-campaign detail
   *  views may still aggregate Message directly; these are for
   *  Campaign History's list view, where aggregating per-row would be
   *  real, avoidable cost. */
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  lastError?: string;
  /** Module 2.5 — incremented whenever a real inbound WhatsApp message
   *  arrives from a contact this campaign previously messaged (see
   *  conversationService.recordInboundMessage's own attribution hook).
   *  Deliberately a simple event count, not a deduplicated
   *  distinct-contact count — the same "denormalized rollup, not an
   *  aggregate query" shape sentCount/deliveredCount already take. */
  replyCount: number;
  /** Module 2.5 — the subset of replyCount that were an interactive
   *  button/list tap (messageType "button_reply"/"list_reply") rather
   *  than free text — the closest real signal to "clicked" a WhatsApp
   *  message actually exposes without Meta's own separate URL-click
   *  analytics API, which this app has no integration with. */
  clickCount: number;
  /** Module 2.5 — hidden from the default campaign list, same
   *  "excluded unless explicitly requested" precedent Lead.archived
   *  already established (module 1.4). Purely a visibility toggle —
   *  an archived campaign's own status/counters are untouched. */
  archived: boolean;
  /** Module 2.5 — set only when this campaign was auto-created by
   *  another campaign's recurrenceRule, or created via the "Duplicate"
   *  action. Provenance only; nothing reads this to change behavior. */
  clonedFromId?: string;
  recurrenceRule?: CampaignRecurrenceRule;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsAppCampaignInput {
  name: string;
  templateId: string;
  marketingCampaignId?: string;
  recurrenceRule?: CampaignRecurrenceRule;
  clonedFromId?: string;
}

export interface WhatsAppCampaignListFilters {
  status?: WhatsAppCampaignStatus;
  search?: string;
  /** Defaults to excluding archived campaigns — same "archived=false
   *  unless explicitly requested" convention leadService.listLeads
   *  already applies. */
  archived?: boolean;
}

export interface WhatsAppCampaignRepository {
  create(input: CreateWhatsAppCampaignInput): Promise<WhatsAppCampaign>;
  findById(id: string): Promise<WhatsAppCampaign | null>;
  list(filters: WhatsAppCampaignListFilters, page: number, limit: number): Promise<PaginatedResult<WhatsAppCampaign>>;
  update(
    id: string,
    patch: Partial<
      Pick<
        WhatsAppCampaign,
        | "status"
        | "audienceSource"
        | "audienceSnapshotAt"
        | "scheduledFor"
        | "recipientCount"
        | "lastError"
        | "archived"
        | "recurrenceRule"
      >
    >,
  ): Promise<WhatsAppCampaign>;
  /** Atomic increment of one or more rollup counters — used by the
   *  message-send job handler and the webhook handler whenever a
   *  Message's status changes. */
  incrementCounts(
    id: string,
    delta: Partial<Record<"sentCount" | "deliveredCount" | "readCount" | "failedCount" | "replyCount" | "clickCount", number>>,
    session?: ClientSession,
  ): Promise<WhatsAppCampaign>;
  /** Due scheduled campaigns — used by the promote-scheduled job
   *  handler. Kept on the repository (not just a scheduler payload
   *  query) since "which campaigns are scheduled for now" is a
   *  meaningful domain query independent of the job queue. */
  findDueScheduled(now: Date): Promise<WhatsAppCampaign[]>;
}

// ─── CampaignTemplate ───────────────────────────────────────────────────

/** Module 2.3 — a template's last-known approval state from the vendor.
 *  "unknown" (never synced) is distinct from "pending" (synced, and the
 *  vendor is still reviewing it) — a template created before this
 *  module shipped, or before the sync job's first run, is "unknown",
 *  not silently assumed approved. */
export type TemplateApprovalStatus = "unknown" | "approved" | "pending" | "rejected";

export interface CampaignTemplate {
  id: string;
  name: string;
  metaTemplateName: string;
  languageCode: string;
  variableLabels: string[];
  /** Module 2.3 — Template Sync. Defaults to "unknown", set by
   *  whatsapp.template_sync's scheduled job, never by hand. */
  approvalStatus: TemplateApprovalStatus;
  approvalStatusCheckedAt?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignTemplateInput {
  name: string;
  metaTemplateName: string;
  languageCode: string;
  variableLabels: string[];
}

export interface UpdateCampaignTemplateApprovalInput {
  approvalStatus: TemplateApprovalStatus;
  approvalStatusCheckedAt: string;
}

/** Admin Dashboard — Templates page filters. */
export interface CampaignTemplateListFilters {
  search?: string;
}

export interface CampaignTemplateRepository {
  create(input: CreateCampaignTemplateInput): Promise<CampaignTemplate>;
  findById(id: string): Promise<CampaignTemplate | null>;
  list(filters: CampaignTemplateListFilters, page: number, limit: number): Promise<PaginatedResult<CampaignTemplate>>;
  /** Module 2.3 — every template, unpaginated: the sync job needs to
   *  walk the full catalog every cycle, not one admin-facing page at a
   *  time. */
  listAll(): Promise<CampaignTemplate[]>;
  updateApprovalStatus(id: string, patch: UpdateCampaignTemplateApprovalInput): Promise<CampaignTemplate>;
}

// ─── Message ────────────────────────────────────────────────────────────

export type MessageStatus = "queued" | "sending" | "sent" | "delivered" | "read" | "failed";

/** WhatsApp Platform (Phase 2) — which direction a Message travelled.
 *  Defined here (not in lib/services/conversations) since direction is
 *  fundamentally a Message-level fact; Conversation imports this type
 *  rather than the other way around. */
export type MessageDirection = "inbound" | "outbound";

export interface Message {
  id: string;
  campaignId?: string;
  /** Required for a WhatsApp message, unset for an email message — see
   *  recipientEmail below. Module 4.2 made this optional rather than
   *  renaming it, the same additive shape Conversation's own
   *  contactPhoneE164/contactEmail split already took. */
  recipientPhoneE164?: string;
  /** Module 4.2 (Email Channel) — required for an email message, unset
   *  for a WhatsApp message. */
  recipientEmail?: string;
  recipientName?: string;
  leadId?: string;
  registrationId?: string;
  templateId?: string;
  /** Enterprise Analytics (Phase 7), module 7.2 — set only by
   *  sendWhatsAppTemplate.ts/sendEmail.ts (the automation engine's own
   *  message-sending executors) to the WorkflowRun that sent this
   *  message. Unset for every other send path (manual compose, a
   *  WhatsAppCampaign's own bulk send) — the honest join
   *  "automation-generated messages" analytics needs, rather than
   *  inferring automation-origin from the absence of campaignId (a
   *  manual compose reply is also campaignId-less). */
  workflowRunId?: string;
  /** Module 4.2 — an outbound/inbound email's subject line. WhatsApp
   *  messages have no subject concept; always unset for those. */
  subject?: string;
  status: MessageStatus;
  provider?: WhatsAppProviderId | EmailProviderId;
  providerMessageId?: string;
  failureReason?: string;
  /** WhatsApp Platform (Phase 2) — the Conversation this message
   *  belongs to in the unified thread view. Optional/backfilled: every
   *  Message created before 2.1 shipped gets one via
   *  scripts/backfillConversations.ts, not a live migration. */
  conversationId?: string;
  /** "outbound" for every message this app sends (the only kind that
   *  existed before 2.1); "inbound" for a contact's reply, captured for
   *  the first time by this module. Defaults to "outbound" for any
   *  legacy row that predates this field — see the model's own default. */
  direction?: MessageDirection;
  /** Free-text content for the thread view. Inbound: the contact's
   *  actual message text. Outbound template sends: a synthesized
   *  `[Template: name]` label, not a reconstruction of the rendered
   *  variables — Message never stored the real rendered text before
   *  this field existed, and back-filling a plausible-looking fake body
   *  for old sends would be worse than an honest placeholder. */
  body?: string;
  /** Module 2.2 (Rich Messaging) — defaults to "text" for every row
   *  that predates this field (plain sends, and every Message 2.1's own
   *  backfill created). */
  messageType?: MessageContentType;
  /** Inbound image/video/audio/document only — the vendor's media id,
   *  never a directly fetchable URL. See WhatsAppInboundMessage's own
   *  doc comment on why this app resolves it on demand instead of
   *  storing a URL that would go stale. Never sent to the browser
   *  directly — the thread API substitutes `mediaUrl` (the proxy route
   *  path) in its place. */
  mediaId?: string;
  mediaMimeType?: string;
  /** Outbound media sends only — the public URL the admin supplied (see
   *  WhatsAppMediaPayload). For inbound media, this is instead
   *  synthesized as the proxy route path
   *  (/api/admin/conversations/media/{id}) once mediaId is known — see
   *  conversationService.recordInboundMessage. */
  mediaUrl?: string;
  /** Structured content for interactive_button/interactive_list sends
   *  and button_reply/list_reply/location/contacts/reaction receipts —
   *  see MessageContentType's own doc comment for the shape per type. */
  interactivePayload?: Record<string, unknown>;
  /** Mirrors the corresponding ScheduledJob's attempts once one exists
   *  for this message — kept on Message too so a Message's own history
   *  is readable without joining the generic job queue. */
  attempts: number;
  queuedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageInput {
  campaignId?: string;
  recipientPhoneE164?: string;
  recipientEmail?: string;
  recipientName?: string;
  leadId?: string;
  registrationId?: string;
  templateId?: string;
  workflowRunId?: string;
  subject?: string;
  conversationId?: string;
  direction?: MessageDirection;
  body?: string;
  messageType?: MessageContentType;
  mediaId?: string;
  mediaMimeType?: string;
  mediaUrl?: string;
  interactivePayload?: Record<string, unknown>;
}

export interface MessageListFilters {
  campaignId?: string;
  status?: MessageStatus;
  /** WhatsApp Platform (Phase 2) — the thread view's own filter: every
   *  message belonging to one Conversation. */
  conversationId?: string;
  /** Enterprise Analytics (Phase 7), module 7.2 — every Message a given
   *  WorkflowRun sent. */
  workflowRunId?: string;
  /** true: only messages some WorkflowRun sent (workflowRunId set at
   *  all, regardless of which run) — the account-wide "automation-
   *  generated messages" count, without an N+1 per-run query. */
  hasWorkflowRunId?: boolean;
  leadId?: string;
  /** Inclusive ISO bounds against createdAt — module 7.2's date-range
   *  scoped analytics, the same createdAfter/createdBefore convention
   *  leadService/paymentService already use. */
  createdAfter?: string;
  createdBefore?: string;
}

export interface MessageStatusCounts {
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface MessageRepository {
  create(input: CreateMessageInput): Promise<Message>;
  createMany(inputs: CreateMessageInput[]): Promise<Message[]>;
  findById(id: string): Promise<Message | null>;
  findByProviderMessageId(providerMessageId: string): Promise<Message | null>;
  list(filters: MessageListFilters, page: number, limit: number): Promise<PaginatedResult<Message>>;
  /** Module 2.5 — Campaign Enhancements' reply/click attribution: the
   *  most recent *outbound* Message with a campaignId sent to this
   *  phone number, if any. `conversationService.recordInboundMessage`
   *  uses this to decide whether (and which campaign) an inbound reply
   *  should be attributed to. Returns null if this contact has never
   *  received a campaign message — most inbound messages, correctly. */
  findLatestOutboundCampaignMessage(recipientPhoneE164: string): Promise<Message | null>;
  update(
    id: string,
    patch: Partial<
      Pick<
        Message,
        | "status"
        | "provider"
        | "providerMessageId"
        | "failureReason"
        | "attempts"
        | "sentAt"
        | "deliveredAt"
        | "readAt"
        | "failedAt"
        | "conversationId"
        | "direction"
        | "body"
        | "messageType"
        | "mediaId"
        | "mediaMimeType"
        | "mediaUrl"
        | "interactivePayload"
      >
    >,
  ): Promise<Message>;
  /** Exact, live aggregation for a single campaign's detail view — see
   *  CAMPAIGN_ARCHITECTURE.md §9 on why this coexists with
   *  WhatsAppCampaign's denormalized counters rather than replacing
   *  them. */
  /** Omit campaignId for an app-wide aggregate across every Message
   *  regardless of source (bulk campaign or automation-triggered single
   *  send) — the Admin Dashboard Analytics page's WhatsApp performance
   *  section (RC-1). */
  countByStatus(campaignId?: string): Promise<MessageStatusCounts>;
  /** Every failed Message for a campaign — what "Retry Failed" resets
   *  to queued. */
  findFailedByCampaign(campaignId: string): Promise<Message[]>;
}

// ─── MessageAttempt ─────────────────────────────────────────────────────

export type MessageAttemptStatus = "success" | "failure";

export interface MessageAttempt {
  id: string;
  messageId: string;
  attemptNumber: number;
  status: MessageAttemptStatus;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  attemptedAt: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
}

export interface CreateMessageAttemptInput {
  messageId: string;
  attemptNumber: number;
  status: MessageAttemptStatus;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface MessageAttemptRepository {
  create(input: CreateMessageAttemptInput): Promise<MessageAttempt>;
  findByMessage(messageId: string): Promise<MessageAttempt[]>;
}

// ─── Validation / results ───────────────────────────────────────────────

export interface CampaignValidationError {
  field: string;
  message: string;
}

export type CreateWhatsAppCampaignResult =
  | { success: true; campaign: WhatsAppCampaign }
  | { success: false; errors: CampaignValidationError[] };

export type CreateCampaignTemplateResult =
  | { success: true; template: CampaignTemplate }
  | { success: false; errors: CampaignValidationError[] };

// ─── Audience selection ─────────────────────────────────────────────────

/**
 * Three sources, one resolution rule (CAMPAIGN_ARCHITECTURE.md §5):
 * regardless of source, resolving an audience produces a concrete set
 * of Message rows once — never a live query re-run at send time.
 * `filter` targets Leads specifically (the entity that actually has a
 * phone number) — Registration-based targeting would need a join
 * against Lead and is deliberately out of scope for this pass (see
 * CHANGELOG's future considerations).
 */
export type ResolveAudienceInput =
  | { source: "filter"; leadFilters: LeadListFilters }
  | { source: "manual"; recipients: { phoneE164: string; name?: string }[] };

export interface AudienceResolutionResult {
  recipientCount: number;
  rejected: { rawPhone: string; reason: string }[];
}

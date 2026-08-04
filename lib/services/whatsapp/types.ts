/**
 * WhatsApp domain layer.
 *
 * WhatsAppProvider is the dependency-inversion boundary for this module:
 * the application layer (whatsappService.ts) and every future caller
 * depend only on this interface, never on a vendor SDK or a specific
 * adapter. Concrete vendors (Meta Cloud API, AiSensy, Interakt, WATI,
 * Gallabox) each implement it in lib/services/whatsapp/providers/.
 */

export type WhatsAppProviderId =
  | "console"
  | "meta-cloud-api"
  | "aisensy"
  | "interakt"
  | "wati"
  | "gallabox";

export interface WhatsAppRecipient {
  /** E.164 format, e.g. "+919876543210". Callers normalize before calling
   *  the service — see lib/ai-bootcamp/validation.ts's
   *  normalizeIndianMobile for an existing example of this normalization. */
  phoneE164: string;
  name?: string;
}

/**
 * A pre-approved WhatsApp template send. Every supported vendor requires
 * business-initiated messages to use a pre-approved template outside an
 * open customer-service session — this shape is the common denominator:
 * a template name, its approved language, and an ordered list of values
 * substituted into the template's {{1}}, {{2}}, ... placeholders. Each
 * adapter is responsible for translating this into its own vendor-specific
 * payload shape (named "components", "templateParams", "bodyValues",
 * "parameters", etc. depending on the vendor).
 */
export interface WhatsAppTemplatePayload {
  templateName: string;
  languageCode: string;
  variables: string[];
}

export interface WhatsAppError {
  code: string;
  message: string;
  retryable: boolean;
  /** Original vendor error payload, kept for debugging — never shown to end users. */
  raw?: unknown;
}

export type WhatsAppSendResult =
  | { success: true; provider: WhatsAppProviderId; providerMessageId: string }
  | { success: false; provider: WhatsAppProviderId; error: WhatsAppError };

/** The query params a vendor's one-time webhook-setup verification
 *  handshake sends (named after Meta's hub.mode/hub.verify_token/
 *  hub.challenge convention — other vendors' equivalents, if any, map
 *  onto the same three fields). */
export interface WhatsAppWebhookChallenge {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
}

export type WhatsAppWebhookEventType = "sent" | "delivered" | "read" | "failed";

/** Normalized shape for an inbound delivery/read status update —
 *  vendor-agnostic, the same reason WhatsAppTemplatePayload exists for
 *  outbound sends. */
export interface WhatsAppWebhookEvent {
  type: WhatsAppWebhookEventType;
  providerMessageId: string;
  recipientPhoneE164: string;
  timestamp: string;
  /** Present only for type: "failed". */
  errorMessage?: string;
}

/** Module 2.2 (Rich Messaging) — every inbound/outbound content shape
 *  this app understands. "contacts" matches Meta's own plural naming for
 *  the vCard-share message type. `button_reply`/`list_reply` are a
 *  contact's tap on an interactive message *this app* sent; `reaction`
 *  is a contact's emoji reaction to an earlier message — both inbound
 *  only, there is no such thing as sending one.
 *
 *  "email" was added by module 4.2 (Email Channel Integration) — this
 *  type is used generically by the shared `Message` entity
 *  (lib/services/whatsappCampaigns/types.ts), not exclusively by
 *  WhatsApp, even though it still lives in this file (moving it to a
 *  channel-neutral location would be a larger, unrelated refactor
 *  touching every existing WhatsApp import site for no behavioral
 *  gain). */
export type MessageContentType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "location"
  | "contacts"
  | "interactive_button"
  | "interactive_list"
  | "button_reply"
  | "list_reply"
  | "reaction"
  | "email";

/** WhatsApp Platform (Phase 2) — a contact's inbound reply, normalized
 *  the same vendor-agnostic way WhatsAppWebhookEvent already is for
 *  status updates. A separate type/method from WhatsAppWebhookEvent
 *  rather than folding "received" into WhatsAppWebhookEventType: the
 *  fields genuinely differ (this carries real content and a contact
 *  name; a status event never does), and status-event parsing is
 *  already shipped/tested — this is additive, not a change to it. */
export interface WhatsAppInboundMessage {
  providerMessageId: string;
  fromPhoneE164: string;
  contactName?: string;
  /** Module 2.2 — what kind of content this is. Every non-text type
   *  still gets a real value here (not the interactive/media union
   *  itself); the structured payload lives in `interactivePayload`. */
  messageType: MessageContentType;
  /** Real text for a text message; a human-readable fallback for
   *  everything else (e.g. "📷 Photo", "Tapped: Book a call") — always
   *  safe to render directly in a list preview or a bubble that hasn't
   *  been specially handled. */
  body: string;
  /** Set for image/video/audio/document only — the vendor's own media
   *  id, not a fetchable URL. Meta's media URLs are short-lived and
   *  auth-gated, so the app resolves this server-side on demand (see
   *  WhatsAppProvider.resolveMediaUrl) rather than storing a URL that
   *  would go stale. */
  mediaId?: string;
  mediaMimeType?: string;
  /** Structured extra data a plain `body` string can't carry:
   *  button_reply/list_reply → `{id, title, description?}`; location →
   *  `{latitude, longitude, name?, address?}`; contacts →
   *  `{contacts: [{name, phones}]}`; reaction → `{emoji,
   *  reactedToProviderMessageId}`. Absent for text/media. */
  interactivePayload?: Record<string, unknown>;
  timestamp: string;
}

/** Module 2.2 — a single quick-reply button on an outbound interactive
 *  "button" message. Meta caps both the count (3) and the title length
 *  (20 chars) — the provider adapter is responsible for enforcing that,
 *  not this shared type. */
export interface WhatsAppQuickReplyButton {
  id: string;
  title: string;
}

export interface WhatsAppInteractiveButtonsPayload {
  bodyText: string;
  buttons: WhatsAppQuickReplyButton[];
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title?: string;
  rows: WhatsAppListRow[];
}

export interface WhatsAppInteractiveListPayload {
  bodyText: string;
  /** Label on the button that opens the list — Meta's "button" field. */
  buttonText: string;
  sections: WhatsAppListSection[];
}

export type WhatsAppMediaKind = "image" | "video" | "audio" | "document";

/** Module 2.2 — an outbound media send. `url` must already be publicly
 *  fetchable by Meta; this app has no managed upload/hosting of its own
 *  yet (that's Module 6.2, File Storage — see the Business OS blueprint's
 *  explicit dependency note on this module). Until then, callers supply
 *  a URL that's already public (an asset already hosted elsewhere). */
export interface WhatsAppMediaPayload {
  kind: WhatsAppMediaKind;
  url: string;
  caption?: string;
  /** Documents only — the filename WhatsApp displays to the recipient. */
  filename?: string;
}

/** Module 2.2 — the result of resolving a vendor media id to something
 *  actually fetchable. `url` and any auth this app needed to reach it
 *  are the provider's concern; a caller (the media proxy route) fetches
 *  `url` using whatever the provider tells it to, never the raw vendor
 *  credentials directly. */
export interface WhatsAppResolvedMedia {
  url: string;
  mimeType: string;
  /** Extra headers the caller must send when fetching `url` (e.g. Meta
   *  requires the same bearer token used for the Graph API call) — kept
   *  out of the media proxy route entirely, so no vendor credential ever
   *  needs to leave this module. */
  fetchHeaders: Record<string, string>;
}

export interface WhatsAppProvider {
  /** Stable id, matches WhatsAppProviderId. Used for registry lookups,
   *  result tagging, and error messages. */
  readonly id: WhatsAppProviderId;

  /**
   * Free-form text message. Only deliverable inside a vendor's 24-hour
   * customer-service window (i.e. after the recipient has messaged first)
   * — never usable as the first outbound contact. Prefer sendTemplate for
   * anything business-initiated (registration confirmations, reminders).
   */
  sendText(recipient: WhatsAppRecipient, body: string): Promise<WhatsAppSendResult>;

  /** Pre-approved template send — the primary way this app contacts a
   *  lead/student who hasn't messaged first. */
  sendTemplate(
    recipient: WhatsAppRecipient,
    payload: WhatsAppTemplatePayload,
  ): Promise<WhatsAppSendResult>;

  /** Handles the vendor's one-time webhook-setup verification handshake
   *  (a GET request with query params). Returns the value to echo back
   *  as the response body if verification succeeds, or null to reject
   *  (the caller responds 403). */
  verifyWebhookChallenge(challenge: WhatsAppWebhookChallenge): string | null;

  /** Verifies the authenticity of an inbound webhook POST (e.g. an HMAC
   *  signature header) against the exact raw request body, and if valid,
   *  parses it into normalized events. Returns null if the signature is
   *  invalid or the payload doesn't parse — callers should treat null as
   *  "reject the webhook", not "no events". */
  parseWebhookEvent(rawBody: string, signatureHeader: string | null): WhatsAppWebhookEvent[] | null;

  /** WhatsApp Platform (Phase 2) — same signature verification
   *  contract as parseWebhookEvent, for the `messages[]` half of the
   *  same webhook payload instead of the `statuses[]` half. Optional:
   *  only the provider actually wired to a real vendor needs to
   *  implement this today — every stub provider (aisensy/wati/interakt/
   *  gallabox) already throws WhatsAppProviderNotImplementedError on
   *  every other method and is untouched by this addition. */
  parseInboundMessages?(rawBody: string, signatureHeader: string | null): WhatsAppInboundMessage[] | null;

  /** Module 2.2 — an interactive "button" message: body text plus up to
   *  a handful of quick-reply buttons. Optional for the same reason
   *  parseInboundMessages is: only a provider actually wired to a real
   *  vendor needs to implement it, every stub provider is untouched. */
  sendInteractiveButtons?(
    recipient: WhatsAppRecipient,
    payload: WhatsAppInteractiveButtonsPayload,
  ): Promise<WhatsAppSendResult>;

  /** Module 2.2 — an interactive "list" message: body text plus a
   *  single button that opens a sectioned list of selectable rows. */
  sendInteractiveList?(
    recipient: WhatsAppRecipient,
    payload: WhatsAppInteractiveListPayload,
  ): Promise<WhatsAppSendResult>;

  /** Module 2.2 — image/video/audio/document by URL. See
   *  WhatsAppMediaPayload's own doc comment on why `url` must already be
   *  public: this app has no managed upload/hosting yet (Module 6.2). */
  sendMedia?(recipient: WhatsAppRecipient, payload: WhatsAppMediaPayload): Promise<WhatsAppSendResult>;

  /** Module 2.2 — resolves an inbound message's vendor media id (from
   *  WhatsAppInboundMessage.mediaId) to a URL and the headers needed to
   *  actually fetch it. Returns null if the id is unknown or has expired
   *  on the vendor's side (inbound media is not durably re-hosted by
   *  this app — see the media proxy route's own doc comment). */
  resolveMediaUrl?(mediaId: string): Promise<WhatsAppResolvedMedia | null>;

  /** Module 2.3 — Template Sync. Fetches every template's current
   *  approval state from the vendor, keyed by the vendor's own template
   *  name (`metaTemplateName` on this app's own CampaignTemplate) so the
   *  caller can reconcile without knowing anything vendor-specific.
   *  Returns null on any failure (missing credentials, network error) —
   *  the same "null means couldn't do it, not zero results" convention
   *  parseWebhookEvent already uses. Optional for the same reason every
   *  other Module-2.2/2.3 addition is: only a provider wired to a real
   *  vendor needs to implement it. */
  listTemplateApprovalStatuses?(): Promise<WhatsAppTemplateApprovalStatus[] | null>;

  /** Module 2.3 — Business Account Health. Fetches the configured phone
   *  number's current quality rating (and messaging limit tier, when the
   *  vendor exposes one). Returns null on any failure, same convention
   *  as above. */
  getPhoneNumberHealth?(): Promise<WhatsAppPhoneNumberHealth | null>;
}

/** Module 2.3 — one template's live approval state as reported by the
 *  vendor right now, not this app's own cached copy. */
export interface WhatsAppTemplateApprovalStatus {
  metaTemplateName: string;
  status: "approved" | "pending" | "rejected";
}

/** Module 2.3 — a phone number's live health snapshot. `messagingLimit`
 *  is deliberately a free-form string, not a fixed union: it echoes
 *  whatever tier label the vendor's API returns (e.g. Meta's own
 *  "TIER_1K"/"TIER_10K" naming) rather than this app inventing its own
 *  enum for a value it only ever displays, never branches logic on. */
export interface WhatsAppPhoneNumberHealth {
  phoneNumberId: string;
  displayPhoneNumber?: string;
  qualityRating: "green" | "yellow" | "red" | "unknown";
  messagingLimit?: string;
}

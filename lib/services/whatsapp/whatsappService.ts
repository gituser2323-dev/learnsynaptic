import { randomUUID } from "crypto";
import { getWhatsAppProvider, resolveWhatsAppProviderForSend } from "./registry";
import { processSendJob } from "./queue";
import { WhatsAppProviderNotImplementedError } from "./errors";
import type {
  WhatsAppRecipient,
  WhatsAppSendResult,
  WhatsAppWebhookChallenge,
  WhatsAppWebhookEvent,
  WhatsAppInboundMessage,
  WhatsAppQuickReplyButton,
  WhatsAppListSection,
  WhatsAppMediaPayload,
  WhatsAppResolvedMedia,
  WhatsAppTemplateApprovalStatus,
  WhatsAppPhoneNumberHealth,
} from "./types";

/**
 * Application-layer WhatsApp service — the module the rest of the app
 * should import (re-exported from index.ts). Depends solely on the
 * WhatsAppProvider abstraction via getWhatsAppProvider()/processSendJob():
 * changing WHATSAPP_PROVIDER in config/whatsapp.ts changes which vendor
 * actually sends these messages, and which vendor verifies/parses
 * webhooks, without a single line changing here or at any call site.
 *
 * Method names describe business use-cases, not vendor operations, so a
 * caller building (say) the registration flow doesn't need to know
 * whether "registration confirmation" is a Meta template, an AiSensy
 * campaign, or an Interakt template — that mapping lives here, once,
 * instead of being duplicated at every call site.
 *
 * Sends route through processSendJob() (queue.ts) rather than calling
 * the provider directly — today that's synchronous ("a queue of one"),
 * but the job shape is already what a real queue producer/consumer pair
 * would use, so adding one later doesn't require touching this file.
 *
 * Not yet called from anywhere in the app: the leadService/
 * registrationService integration this was built for is a deliberate
 * follow-up decision, not made here — see CHANGELOG.md.
 */
export const whatsappService = {
  /** Post-registration confirmation, sent immediately after signup. */
  sendRegistrationConfirmation(
    recipient: WhatsAppRecipient,
    data: { programName: string; cohortDate: string },
  ): Promise<WhatsAppSendResult> {
    return processSendJob({
      id: randomUUID(),
      type: "template",
      recipient,
      templatePayload: {
        templateName: "registration_confirmation",
        languageCode: "en",
        variables: [recipient.name ?? "there", data.programName, data.cohortDate],
      },
      enqueuedAt: new Date().toISOString(),
    });
  },

  /** Cohort/live-session reminder (see ARCHITECTURE.md Workflow 5.1, the
   *  T-24h/T-1h reminder step of the acquisition funnel). */
  sendCohortReminder(
    recipient: WhatsAppRecipient,
    data: { sessionTitle: string; startsAt: string },
  ): Promise<WhatsAppSendResult> {
    return processSendJob({
      id: randomUUID(),
      type: "template",
      recipient,
      templatePayload: {
        templateName: "cohort_reminder",
        languageCode: "en",
        variables: [recipient.name ?? "there", data.sessionTitle, data.startsAt],
      },
      enqueuedAt: new Date().toISOString(),
    });
  },

  /** Generic template send for callers that need an arbitrary
   *  pre-approved template rather than one of the named, single-purpose
   *  methods above — e.g. the automation engine (lib/services/automation),
   *  which runs a multi-step sequence of different templates that don't
   *  map onto one method each. */
  sendTemplateMessage(
    recipient: WhatsAppRecipient,
    templateName: string,
    languageCode: string,
    variables: string[],
  ): Promise<WhatsAppSendResult> {
    return processSendJob({
      id: randomUUID(),
      type: "template",
      recipient,
      templatePayload: { templateName, languageCode, variables },
      enqueuedAt: new Date().toISOString(),
    });
  },

  /** Escape hatch for a free-form message — only deliverable inside a
   *  vendor's 24h customer-service window (i.e. after the recipient has
   *  replied at least once). Prefer a named template method above when
   *  the message is business-initiated. */
  sendPlainText(recipient: WhatsAppRecipient, body: string): Promise<WhatsAppSendResult> {
    return processSendJob({
      id: randomUUID(),
      type: "text",
      recipient,
      textBody: body,
      enqueuedAt: new Date().toISOString(),
    });
  },

  /** Handles the active provider's one-time webhook-setup verification
   *  handshake. See app/api/webhooks/whatsapp/route.ts's GET handler. */
  verifyWebhookChallenge(challenge: WhatsAppWebhookChallenge): string | null {
    return getWhatsAppProvider().verifyWebhookChallenge(challenge);
  },

  /** Verifies and parses an inbound webhook POST body via the active
   *  provider. See app/api/webhooks/whatsapp/route.ts's POST handler. */
  parseWebhookEvent(rawBody: string, signatureHeader: string | null): WhatsAppWebhookEvent[] | null {
    return getWhatsAppProvider().parseWebhookEvent(rawBody, signatureHeader);
  },

  /** WhatsApp Platform (Phase 2) — `null` when the active provider
   *  doesn't implement inbound parsing at all (every stub provider,
   *  and dev's console provider) — the caller treats that the same as
   *  "no inbound messages in this payload," not an error. */
  parseInboundMessages(rawBody: string, signatureHeader: string | null): WhatsAppInboundMessage[] | null {
    return getWhatsAppProvider().parseInboundMessages?.(rawBody, signatureHeader) ?? null;
  },

  /** Module 2.2 — an interactive quick-reply-buttons send, e.g. a
   *  counsellor replying from the Conversation thread with "Book a
   *  call" / "Send brochure" / "Not now". Throws
   *  WhatsAppProviderNotImplementedError if the active provider hasn't
   *  wired this up (every provider but meta-cloud-api, today) — the
   *  same loud-failure posture the rest of this module already takes
   *  for a genuinely unimplemented capability, not a soft null. */
  async sendInteractiveButtonsMessage(
    recipient: WhatsAppRecipient,
    bodyText: string,
    buttons: WhatsAppQuickReplyButton[],
  ): Promise<WhatsAppSendResult> {
    const provider = await resolveWhatsAppProviderForSend();
    if (!provider.sendInteractiveButtons) throw new WhatsAppProviderNotImplementedError(provider.id);
    return provider.sendInteractiveButtons(recipient, { bodyText, buttons });
  },

  /** Module 2.2 — an interactive list send (a menu of selectable rows,
   *  optionally grouped into sections). */
  async sendInteractiveListMessage(
    recipient: WhatsAppRecipient,
    bodyText: string,
    buttonText: string,
    sections: WhatsAppListSection[],
  ): Promise<WhatsAppSendResult> {
    const provider = await resolveWhatsAppProviderForSend();
    if (!provider.sendInteractiveList) throw new WhatsAppProviderNotImplementedError(provider.id);
    return provider.sendInteractiveList(recipient, { bodyText, buttonText, sections });
  },

  /** Module 2.2 — image/video/audio/document by URL. See
   *  WhatsAppMediaPayload's doc comment: `payload.url` must already be
   *  public (Module 6.2, File Storage, isn't built yet). */
  async sendMediaMessage(recipient: WhatsAppRecipient, payload: WhatsAppMediaPayload): Promise<WhatsAppSendResult> {
    const provider = await resolveWhatsAppProviderForSend();
    if (!provider.sendMedia) throw new WhatsAppProviderNotImplementedError(provider.id);
    return provider.sendMedia(recipient, payload);
  },

  /** Module 2.2 — resolves an inbound message's vendor media id to a
   *  fetchable URL, for the media proxy route. Unlike the send methods
   *  above, a missing capability here returns `null` rather than
   *  throwing: "can't render this attachment" is a normal, soft outcome
   *  for the thread UI (it already falls back to the message's `body`
   *  text), not a configuration error worth failing loud over. */
  async resolveInboundMediaUrl(mediaId: string): Promise<WhatsAppResolvedMedia | null> {
    const provider = await resolveWhatsAppProviderForSend();
    if (!provider.resolveMediaUrl) return null;
    return provider.resolveMediaUrl(mediaId);
  },

  /** Module 2.3 — Template Sync. `null` covers both "provider doesn't
   *  implement this" and "the vendor call itself failed" — the caller
   *  (the scheduler job) treats either the same way: skip this cycle,
   *  try again next time, never crash the poller. Business OS Phase 8,
   *  Module 8.5 — the scheduler job now calls this once per connected
   *  organization, each inside its own `runWithTenantContext`, so
   *  `resolveWhatsAppProviderForSend()`'s ambient-context read resolves
   *  that organization's own WABA, never this deployment's default. */
  async listTemplateApprovalStatuses(): Promise<WhatsAppTemplateApprovalStatus[] | null> {
    const provider = await resolveWhatsAppProviderForSend();
    if (!provider.listTemplateApprovalStatuses) return null;
    return provider.listTemplateApprovalStatuses();
  },

  /** Module 2.3 — Business Account Health. Same null convention and
   *  same Module 8.5 per-organization scheduling as above. */
  async getPhoneNumberHealth(): Promise<WhatsAppPhoneNumberHealth | null> {
    const provider = await resolveWhatsAppProviderForSend();
    if (!provider.getPhoneNumberHealth) return null;
    return provider.getPhoneNumberHealth();
  },
};

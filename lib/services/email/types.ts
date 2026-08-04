/**
 * Email domain layer — Communication Center (Phase 4), module 4.2.
 *
 * EmailProvider is the dependency-inversion boundary for this module,
 * the exact same shape lib/services/whatsapp/types.ts's WhatsAppProvider
 * already established one phase earlier: the application layer
 * (emailService.ts) and every caller depend only on this interface,
 * never on a vendor SDK or a specific adapter. Concrete vendors
 * (Postmark, SendGrid, Resend) each implement it in
 * lib/services/email/providers/.
 *
 * Deliberately smaller than WhatsAppProvider: there is no template/
 * pre-approval concept for regular email the way WhatsApp Business
 * messaging requires one, and no interactive buttons/lists/media-resolve
 * — those are WhatsApp-specific rich-messaging concepts (module 2.2)
 * with no email equivalent. A future rich-HTML-compose or attachments
 * capability would extend this interface the same optional-method way
 * module 2.2 extended WhatsAppProvider, not by inventing a new module.
 */

export type EmailProviderId = "console" | "postmark" | "sendgrid" | "resend";

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailSendPayload {
  subject: string;
  bodyText: string;
  /** Optional HTML alternative — not required; a provider without HTML
   *  support can send bodyText alone. */
  bodyHtml?: string;
}

export interface EmailError {
  code: string;
  message: string;
  retryable: boolean;
  /** Original vendor error payload, kept for debugging — never shown to end users. */
  raw?: unknown;
}

export type EmailSendResult =
  | { success: true; provider: EmailProviderId; providerMessageId: string }
  | { success: false; provider: EmailProviderId; error: EmailError };

/** A contact's inbound reply, normalized the same vendor-agnostic way
 *  WhatsAppInboundMessage already is. Unlike WhatsApp, there is no
 *  separate "content type" union to carry — an email is always
 *  subject + body, so this shape doesn't need WhatsAppInboundMessage's
 *  own `messageType` discriminant. */
export interface EmailInboundMessage {
  providerMessageId: string;
  fromEmail: string;
  fromName?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  timestamp: string;
}

export interface EmailProvider {
  /** Stable id, matches EmailProviderId. Used for registry lookups,
   *  result tagging, and error messages. */
  readonly id: EmailProviderId;

  send(recipient: EmailRecipient, payload: EmailSendPayload): Promise<EmailSendResult>;

  /** Verifies the authenticity of an inbound webhook POST against the
   *  exact raw request body and whatever token/signature this app
   *  expects (see each adapter's own doc comment — Postmark uses a
   *  URL-embedded shared secret rather than an HMAC header, unlike
   *  Meta), and if valid, parses it into normalized inbound messages.
   *  Returns null if verification fails or the payload doesn't parse —
   *  callers should treat null as "reject the webhook", not "no
   *  messages". Optional: only a provider actually wired to a real
   *  vendor needs to implement this — every stub provider (sendgrid,
   *  resend today) is untouched, the same posture
   *  WhatsAppProvider.parseInboundMessages already takes. */
  parseInboundEmails?(rawBody: string, token: string | null): EmailInboundMessage[] | null;
}

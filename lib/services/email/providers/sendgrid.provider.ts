import { EmailProviderNotImplementedError } from "../errors";
import type { EmailProvider, EmailSendResult } from "../types";

/**
 * SendGrid adapter — SCAFFOLD ONLY, not yet integrated.
 *
 * Illustrative sketch (verify current field names against SendGrid's
 * docs before implementing):
 *
 *   POST https://api.sendgrid.com/v3/mail/send
 *   Headers: Authorization: Bearer <SENDGRID_CONFIG.apiKey>
 *   Body: { personalizations: [{ to: [{ email: recipient.email }] }],
 *     from: { email: <verified sender> }, subject: payload.subject,
 *     content: [{ type: "text/plain", value: payload.bodyText }] }
 *
 * Key structural difference from Postmark: SendGrid's inbound parse
 * webhook delivers raw multipart/form-data (MIME fields as form parts),
 * not pre-parsed JSON — implementing parseInboundEmails for this vendor
 * would need a multipart parser this repo doesn't currently depend on,
 * unlike Postmark's already-JSON inbound payload.
 */
export const sendgridProvider: EmailProvider = {
  id: "sendgrid",

  async send(): Promise<EmailSendResult> {
    throw new EmailProviderNotImplementedError(this.id);
  },
};

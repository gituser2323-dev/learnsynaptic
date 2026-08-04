import { EmailProviderNotImplementedError } from "../errors";
import type { EmailProvider, EmailSendResult } from "../types";

/**
 * Resend adapter — SCAFFOLD ONLY, not yet integrated.
 *
 * Illustrative sketch (verify current field names against Resend's docs
 * before implementing):
 *
 *   POST https://api.resend.com/emails
 *   Headers: Authorization: Bearer <RESEND_CONFIG.apiKey>
 *   Body: { from: <verified domain sender>, to: [recipient.email],
 *     subject: payload.subject, text: payload.bodyText }
 *
 * Key structural difference from Postmark: Resend's inbound-email
 * support is delivered via a separate webhooks product (event types
 * like `email.received`) with its own signing scheme (Svix headers),
 * not the same request/response shape as its outbound Send API — a
 * real adapter here would need its own signature verification, not a
 * copy of Postmark's URL-token approach.
 */
export const resendProvider: EmailProvider = {
  id: "resend",

  async send(): Promise<EmailSendResult> {
    throw new EmailProviderNotImplementedError(this.id);
  },
};

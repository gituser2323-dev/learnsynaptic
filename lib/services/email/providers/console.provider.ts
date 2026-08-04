import type { EmailProvider, EmailRecipient, EmailSendPayload, EmailSendResult } from "../types";

/**
 * Default/dev provider. Not a vendor — logs the outbound message and
 * returns a synthetic success result instead of making any network call.
 * This is the fallback EMAIL_PROVIDER resolves to (config/emailChannel.ts)
 * whenever no real vendor is configured, so emailService is safe to call
 * from day one — the exact same role
 * lib/services/whatsapp/providers/console.provider.ts already plays for
 * WhatsApp. parseInboundEmails is deliberately NOT implemented here:
 * there is no real inbound webhook to parse without a real vendor behind
 * this provider, and emailService.parseInboundEmails already treats a
 * missing implementation as a soft "no messages," not an error — the
 * same convention whatsappService.parseInboundMessages established.
 */
export const consoleProvider: EmailProvider = {
  id: "console",

  async send(recipient: EmailRecipient, payload: EmailSendPayload): Promise<EmailSendResult> {
    console.info(`[email:console] -> ${recipient.email}: "${payload.subject}" — ${payload.bodyText}`);
    return {
      success: true,
      provider: this.id,
      providerMessageId: `console-${Date.now()}`,
    };
  },
};

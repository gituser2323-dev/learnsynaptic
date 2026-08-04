import { WhatsAppProviderNotImplementedError } from "../errors";
import type { WhatsAppProvider, WhatsAppSendResult, WhatsAppWebhookEvent } from "../types";

/**
 * Interakt adapter — SCAFFOLD ONLY, not yet integrated.
 *
 * Illustrative sketch (verify current field names against Interakt's docs
 * before implementing):
 *
 *   POST https://api.interakt.ai/v1/public/message/
 *   Headers: Authorization: Basic {base64(INTERAKT_CONFIG.apiKey)}
 *   Body: { countryCode: "+91", phoneNumber: <national number, no country code>,
 *     type: "Template",
 *     template: { name: payload.templateName, languageCode: payload.languageCode,
 *       bodyValues: payload.variables } }
 *
 * Key structural difference: Interakt expects the recipient split into
 * countryCode + phoneNumber rather than a single E.164 string — a real
 * implementation would need to split recipient.phoneE164 before calling
 * the API, which is exactly the kind of vendor-specific detail this
 * abstraction exists to keep out of every call site.
 */
export const interaktProvider: WhatsAppProvider = {
  id: "interakt",

  async sendText(): Promise<WhatsAppSendResult> {
    throw new WhatsAppProviderNotImplementedError(this.id);
  },

  async sendTemplate(): Promise<WhatsAppSendResult> {
    throw new WhatsAppProviderNotImplementedError(this.id);
  },

  verifyWebhookChallenge(): string | null {
    throw new WhatsAppProviderNotImplementedError(this.id);
  },

  parseWebhookEvent(): WhatsAppWebhookEvent[] | null {
    throw new WhatsAppProviderNotImplementedError(this.id);
  },
};

import { WhatsAppProviderNotImplementedError } from "../errors";
import type { WhatsAppProvider, WhatsAppSendResult, WhatsAppWebhookEvent } from "../types";

/**
 * Gallabox adapter — SCAFFOLD ONLY, not yet integrated.
 *
 * Illustrative sketch (verify current header/body field names against
 * Gallabox's docs before implementing):
 *
 *   POST https://server.gallabox.com/devapi/messages/whatsapp
 *   Headers: apiKey: GALLABOX_CONFIG.apiKey, apiSecret: GALLABOX_CONFIG.apiSecret
 *   Body: { channelId: GALLABOX_CONFIG.channelId, channelType: "whatsapp",
 *     recipient: { name: recipient.name ?? "", phone: recipient.phoneE164 },
 *     whatsapp: { type: "template",
 *       template: { templateName: payload.templateName, bodyValues: payload.variables } } }
 *
 * Key structural difference: auth is a two-header apiKey/apiSecret pair
 * rather than a single bearer token, and sends are scoped to a specific
 * channelId (Gallabox supports multiple WhatsApp channels per account).
 */
export const gallaboxProvider: WhatsAppProvider = {
  id: "gallabox",

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

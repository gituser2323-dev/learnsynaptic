import { WhatsAppProviderNotImplementedError } from "../errors";
import type { WhatsAppProvider, WhatsAppSendResult, WhatsAppWebhookEvent } from "../types";

/**
 * WATI adapter — SCAFFOLD ONLY, not yet integrated.
 *
 * Illustrative sketch (verify current endpoint shape and parameter naming
 * against WATI's docs before implementing):
 *
 *   POST {WATI_CONFIG.apiEndpoint}/api/v1/sendTemplateMessage?whatsappNumber={recipient.phoneE164}
 *   Headers: Authorization: Bearer {WATI_CONFIG.accessToken}
 *   Body: { template_name: payload.templateName, broadcast_name: payload.templateName,
 *     parameters: payload.variables.map((value, i) => ({ name: String(i + 1), value })) }
 *
 * Key structural difference: WATI's API base URL is per-account (a
 * dedicated subdomain, WATI_CONFIG.apiEndpoint) rather than a single
 * shared host — the adapter's base URL is itself part of the credential
 * set, not a constant.
 */
export const watiProvider: WhatsAppProvider = {
  id: "wati",

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

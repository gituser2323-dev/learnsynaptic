import { WhatsAppProviderNotImplementedError } from "../errors";
import type { WhatsAppProvider, WhatsAppSendResult, WhatsAppWebhookEvent } from "../types";

/**
 * AiSensy adapter — SCAFFOLD ONLY, not yet integrated.
 *
 * Illustrative sketch (verify current field names against AiSensy's docs
 * before implementing):
 *
 *   POST https://backend.aisensy.com/campaign/t1/api/v2
 *   Body: { apiKey: AISENSY_CONFIG.apiKey, campaignName: payload.templateName,
 *     destination: recipient.phoneE164, userName: recipient.name ?? "",
 *     templateParams: payload.variables }
 *
 * Key structural difference from Meta Cloud API: AiSensy models outbound
 * sends as pre-registered "campaigns" rather than raw templates, and
 * authenticates via an apiKey field in the request body rather than an
 * Authorization header — payload.templateName is expected to match a
 * campaign name configured in the AiSensy dashboard, not necessarily
 * Meta's own template name.
 */
export const aisensyProvider: WhatsAppProvider = {
  id: "aisensy",

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

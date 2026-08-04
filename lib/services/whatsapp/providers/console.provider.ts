import type {
  WhatsAppProvider,
  WhatsAppRecipient,
  WhatsAppSendResult,
  WhatsAppTemplatePayload,
  WhatsAppWebhookChallenge,
  WhatsAppWebhookEvent,
  WhatsAppInteractiveButtonsPayload,
  WhatsAppInteractiveListPayload,
  WhatsAppMediaPayload,
} from "../types";

/**
 * Default/dev provider. Not a vendor — logs the outbound message and
 * returns a synthetic success result instead of making any network call.
 * This is the fallback WHATSAPP_PROVIDER resolves to (config/whatsapp.ts)
 * whenever no real vendor is configured, so whatsappService is safe to
 * call from day one.
 */
export const consoleProvider: WhatsAppProvider = {
  id: "console",

  async sendText(recipient: WhatsAppRecipient, body: string): Promise<WhatsAppSendResult> {
    console.info(`[whatsapp:console] -> ${recipient.phoneE164}: ${body}`);
    return {
      success: true,
      provider: this.id,
      providerMessageId: `console-${Date.now()}`,
    };
  },

  async sendTemplate(
    recipient: WhatsAppRecipient,
    payload: WhatsAppTemplatePayload,
  ): Promise<WhatsAppSendResult> {
    console.info(
      `[whatsapp:console] -> ${recipient.phoneE164}: template "${payload.templateName}" ` +
        `(${payload.languageCode}) params=${JSON.stringify(payload.variables)}`,
    );
    return {
      success: true,
      provider: this.id,
      providerMessageId: `console-${Date.now()}`,
    };
  },

  verifyWebhookChallenge(challenge: WhatsAppWebhookChallenge): string | null {
    console.info(`[whatsapp:console] webhook verification requested, mode=${challenge.mode}`);
    return challenge.challenge;
  },

  parseWebhookEvent(rawBody: string): WhatsAppWebhookEvent[] | null {
    console.info(`[whatsapp:console] webhook received (${rawBody.length} bytes) — dev provider does not parse it`);
    return [];
  },

  // Module 2.2 (Rich Messaging) — same "log it, return synthetic
  // success" posture as sendText/sendTemplate above, so the reply
  // composer's buttons/list/media modes are exercisable end-to-end
  // against this dev-fallback provider too, not just against a real
  // vendor. resolveMediaUrl is deliberately NOT implemented here: there
  // is no real inbound media to resolve without a real vendor behind
  // this provider, so leaving it unset (whatsappService.
  // resolveInboundMediaUrl already treats a missing implementation as a
  // soft "can't render this attachment," not an error) is correct.

  async sendInteractiveButtons(
    recipient: WhatsAppRecipient,
    payload: WhatsAppInteractiveButtonsPayload,
  ): Promise<WhatsAppSendResult> {
    console.info(
      `[whatsapp:console] -> ${recipient.phoneE164}: buttons "${payload.bodyText}" ` +
        `[${payload.buttons.map((b) => b.title).join(", ")}]`,
    );
    return { success: true, provider: this.id, providerMessageId: `console-${Date.now()}` };
  },

  async sendInteractiveList(
    recipient: WhatsAppRecipient,
    payload: WhatsAppInteractiveListPayload,
  ): Promise<WhatsAppSendResult> {
    const rowCount = payload.sections.reduce((sum, section) => sum + section.rows.length, 0);
    console.info(
      `[whatsapp:console] -> ${recipient.phoneE164}: list "${payload.bodyText}" ` +
        `button="${payload.buttonText}" rows=${rowCount}`,
    );
    return { success: true, provider: this.id, providerMessageId: `console-${Date.now()}` };
  },

  async sendMedia(recipient: WhatsAppRecipient, payload: WhatsAppMediaPayload): Promise<WhatsAppSendResult> {
    console.info(`[whatsapp:console] -> ${recipient.phoneE164}: ${payload.kind} ${payload.url}`);
    return { success: true, provider: this.id, providerMessageId: `console-${Date.now()}` };
  },
};

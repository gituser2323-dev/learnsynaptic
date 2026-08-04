import { getEmailProvider } from "./registry";
import { getTenantContext } from "@/lib/tenancy/context";
import { resolveBranding } from "@/lib/services/branding";
import type { EmailRecipient, EmailSendPayload, EmailSendResult, EmailInboundMessage } from "./types";

/**
 * Application-layer Email service — the module the rest of the app
 * should import (re-exported from index.ts), mirroring
 * lib/services/whatsapp/whatsappService.ts's own role. Depends solely
 * on the EmailProvider abstraction via getEmailProvider(): changing
 * EMAIL_PROVIDER in config/emailChannel.ts changes which vendor
 * actually sends and receives these messages without a single line
 * changing here or at any call site (conversationService.sendReply,
 * the inbound webhook route).
 *
 * No queue.ts equivalent yet, unlike WhatsApp — email sends here are
 * synchronous, direct provider calls. WhatsApp's queue exists because
 * that module models retry-on-failure at the send-job level for
 * campaign-scale bulk sends (lib/services/whatsappCampaigns); email
 * has no bulk-campaign concept yet (that's a different, larger module
 * than 4.2's channel integration), so there's no real batching need to
 * build a "queue of one" ahead of.
 */
export const emailService = {
  /**
   * Business OS Phase 8, Module 8.4 — appends a real, safe plain-text
   * branding footer (organization name + support email, when the
   * organization is entitled to and has configured white-label
   * branding) before the SAME provider send call this function has
   * always made. Deliberately plain text, never HTML: this app's own
   * email path has no HTML template/builder anywhere (`bodyHtml` is
   * plumbed end-to-end by `EmailSendPayload` but no caller in this
   * codebase ever sets it — confirmed during the pre-build audit), so
   * there is nothing to inject unsafe markup INTO even if
   * `footerText`/`displayName` weren't already validated to reject `<`/`>`
   * at save time (`branding/validation.ts`) — two independent layers
   * of the same "no HTML injection" guarantee, not just one. Reads
   * ambient tenant context rather than a parameter, the same pattern
   * `queue.ts#processSendJob`'s own WhatsApp-side branding-adjacent
   * enforcement already established for this exact call shape; no
   * context at all (a genuinely untenanted system path) sends the
   * email completely unchanged, never blocked — branding is cosmetic,
   * never a delivery gate.
   */
  async sendEmail(recipient: EmailRecipient, payload: EmailSendPayload): Promise<EmailSendResult> {
    const organizationId = getTenantContext()?.organizationId;
    if (!organizationId) return getEmailProvider().send(recipient, payload);

    const branding = await resolveBranding(organizationId);
    if (!branding.isCustom || (!branding.footerText && !branding.supportEmail)) {
      return getEmailProvider().send(recipient, payload);
    }

    const footerLines = [branding.footerText, branding.supportEmail ? `Support: ${branding.supportEmail}` : undefined].filter(Boolean);
    const brandedPayload: EmailSendPayload = { ...payload, bodyText: `${payload.bodyText}\n\n---\n${footerLines.join("\n")}` };
    return getEmailProvider().send(recipient, brandedPayload);
  },

  /** `null` when the active provider doesn't implement inbound parsing
   *  at all (sendgrid/resend stubs, and dev's console provider) — the
   *  caller treats that the same as "no inbound messages in this
   *  payload," not an error, matching
   *  whatsappService.parseInboundMessages's own convention. */
  parseInboundEmails(rawBody: string, token: string | null): EmailInboundMessage[] | null {
    return getEmailProvider().parseInboundEmails?.(rawBody, token) ?? null;
  },
};

import type { EmailProviderId } from "./types";

/**
 * Thrown by any adapter that implements the EmailProvider interface but
 * hasn't had its vendor integration written yet (sendgrid, resend,
 * today) — the exact same "fail loud during development" posture
 * WhatsAppProviderNotImplementedError already established, kept
 * distinct from EmailError (types.ts), which represents a normal,
 * expected send failure (invalid address, vendor outage).
 */
export class EmailProviderNotImplementedError extends Error {
  constructor(providerId: EmailProviderId) {
    super(
      `Email provider "${providerId}" is scaffolded but not yet integrated. ` +
        `See lib/services/email/providers/${providerId}.provider.ts for the ` +
        `integration checklist, or set EMAIL_PROVIDER=console to use the ` +
        `logging-only dev provider.`,
    );
    this.name = "EmailProviderNotImplementedError";
  }
}

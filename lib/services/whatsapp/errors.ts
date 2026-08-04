import type { WhatsAppProviderId } from "./types";

/**
 * Thrown by any adapter that implements the WhatsAppProvider interface
 * but hasn't had its vendor integration written yet (all 5 named vendor
 * adapters, today). Kept distinct from WhatsAppError (types.ts) — that
 * one represents a normal, expected send failure (invalid number, vendor
 * outage); this one represents a configuration/setup gap and is meant to
 * fail loudly during development rather than be swallowed as a "failed"
 * send result.
 */
export class WhatsAppProviderNotImplementedError extends Error {
  constructor(providerId: WhatsAppProviderId) {
    super(
      `WhatsApp provider "${providerId}" is scaffolded but not yet integrated. ` +
        `See lib/services/whatsapp/providers/${providerId}.provider.ts for the ` +
        `integration checklist, or set WHATSAPP_PROVIDER=console to use the ` +
        `logging-only dev provider.`,
    );
    this.name = "WhatsAppProviderNotImplementedError";
  }
}

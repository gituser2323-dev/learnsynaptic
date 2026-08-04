import type { PaymentProviderId } from "./types";

/** The active provider has no real API credentials configured
 *  (config/payments.ts) — mirrors CalendarProviderNotConfiguredError's
 *  own "fail gracefully, this is the expected common case" posture. */
export class PaymentProviderNotConfiguredError extends Error {
  constructor(providerId: PaymentProviderId, reason: string) {
    super(`Payment provider "${providerId}" is not configured: ${reason}.`);
    this.name = "PaymentProviderNotConfiguredError";
  }
}

/** The provider is configured (real API keys exist) but hasn't been
 *  connected+enabled through the Integrations Registry (Module 6.1)
 *  yet — the same two-factor gate fileStorageService/calendarService
 *  enforce for every non-builtIn provider. */
export class PaymentProviderNotConnectedError extends Error {
  constructor(providerId: PaymentProviderId) {
    super(`Payment provider "${providerId}" is not connected and enabled — connect it in Settings → Integrations first.`);
    this.name = "PaymentProviderNotConnectedError";
  }
}

/** A real vendor API call failed — distinct from "not configured"/
 *  "not connected", which are both known, expected states this app
 *  must degrade from gracefully. */
export class PaymentProviderError extends Error {
  constructor(providerId: PaymentProviderId, message: string) {
    super(`Payment provider "${providerId}" error: ${message}`);
    this.name = "PaymentProviderError";
  }
}

/** PhonePe and PayPal are disclosed scaffolds (see config/payments.ts's
 *  own doc comment) — the same "never fabricate a working-looking
 *  integration for a vendor this pass didn't actually implement"
 *  posture WhatsApp's AiSensy/Interakt/WATI/Gallabox and Email's
 *  SendGrid/Resend already established. */
export class PaymentProviderNotImplementedError extends Error {
  constructor(providerId: PaymentProviderId) {
    super(`Payment provider "${providerId}" is not yet implemented — a future module, not this one.`);
    this.name = "PaymentProviderNotImplementedError";
  }
}

export class PaymentNotFoundError extends Error {
  constructor(id: string) {
    super(`Payment ${id} not found.`);
    this.name = "PaymentNotFoundError";
  }
}

/** A webhook's own signature failed verification — never leaks which
 *  specific check failed, the same posture OAuthStateInvalidError
 *  (6.3) already established for a different forged-request scenario. */
export class PaymentWebhookSignatureInvalidError extends Error {
  constructor(providerId: PaymentProviderId) {
    super(`Payment provider "${providerId}" webhook signature is invalid.`);
    this.name = "PaymentWebhookSignatureInvalidError";
  }
}

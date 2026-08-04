/**
 * Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup.
 *
 * Tenant self-service onboarding onto Meta's real, official WhatsApp
 * Business Platform Embedded Signup architecture — a Facebook Login
 * for Business popup (client-side), a server-side authorization-code
 * exchange, then WABA/phone-number discovery, all against Meta's own
 * documented Graph API. No unofficial WhatsApp Web automation, no
 * QR-session scraping, no browser automation, no session cookies —
 * every network call in this module is a real, documented Meta Graph
 * API request the same shape metaCloudApi.provider.ts already makes
 * for messaging.
 */

/** What the client's `FB.login` callback plus the Embedded Signup
 *  popup's own `message` event together produce — the raw input to
 *  the server-side completion call. `code` is Meta's own OAuth-style
 *  authorization code (not a user access token); `wabaId`/`phoneNumberId`
 *  are what the popup's session-info postMessage reports the business
 *  selected or created — never trusted at face value here, always
 *  re-verified server-side against what the exchanged token can
 *  actually see (see embeddedSignupService.connect's own doc comment). */
export interface EmbeddedSignupClientResult {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
}

export type WhatsAppVerificationStatus = "verified" | "not_verified" | "unknown";

/** The rich, UI-facing connection state this module's own mission
 *  explicitly names — deliberately a derived value (never persisted as
 *  its own field) computed fresh from the underlying
 *  IntegrationConnection + PhoneNumberRecord facts each time it's asked
 *  for, so it can never drift out of sync with the data it summarizes. */
export type WhatsAppConnectionState =
  | "not_connected"
  | "connecting"
  | "connected"
  | "healthy"
  | "action_required"
  | "token_expired"
  | "webhook_error"
  | "phone_verification_required"
  | "disconnected";

export interface WhatsAppConnectionSummary {
  state: WhatsAppConnectionState;
  displayPhoneNumber?: string;
  phoneNumberId?: string;
  wabaId?: string;
  qualityRating?: "green" | "yellow" | "red" | "unknown";
  verificationStatus?: WhatsAppVerificationStatus;
  lastCheckedAt?: string;
  lastError?: string;
  connectedAt?: string;
}

export type EmbeddedSignupErrorCode =
  | "not_configured"
  | "invalid_request"
  | "exchange_failed"
  | "discovery_failed"
  | "phone_not_found"
  | "waba_mismatch"
  | "phone_already_connected"
  | "not_entitled"
  | "meta_unavailable";

export class EmbeddedSignupError extends Error {
  constructor(
    public readonly code: EmbeddedSignupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmbeddedSignupError";
  }
}

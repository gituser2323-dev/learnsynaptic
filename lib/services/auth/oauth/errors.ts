import type { OAuthProviderId } from "../types";

/** No real OAuth app credentials configured for this provider
 *  (config/identityOAuth.ts) — mirrors calendar/errors.ts's own
 *  CalendarProviderNotConfiguredError "fail gracefully, this is the
 *  expected common case" posture, since most deployments won't have
 *  every provider's app registered. */
export class OAuthProviderNotConfiguredError extends Error {
  constructor(providerId: OAuthProviderId, reason: string) {
    super(`OAuth provider "${providerId}" is not configured: ${reason}.`);
    this.name = "OAuthProviderNotConfiguredError";
  }
}

/** A real vendor API call (token exchange or profile fetch) failed. */
export class OAuthProviderError extends Error {
  constructor(providerId: OAuthProviderId, message: string) {
    super(`OAuth provider "${providerId}" error: ${message}`);
    this.name = "OAuthProviderError";
  }
}

/** The OAuth `state` param on a callback didn't verify — tampered,
 *  expired, or a replayed/forged request. Never leaks which specific
 *  check failed, the same posture calendar/errors.ts's own
 *  OAuthStateInvalidError takes. */
export class IdentityOAuthStateInvalidError extends Error {
  constructor() {
    super("Invalid or expired OAuth state.");
    this.name = "IdentityOAuthStateInvalidError";
  }
}

/** Login intent, but no OAuthAccount is linked to this provider
 *  identity yet. Deliberately NOT auto-provisioned into a new User nor
 *  auto-linked by email match (see oauthService.ts's own doc comment on
 *  why) — surfaced as a clear, actionable error instead. */
export class OAuthAccountNotLinkedError extends Error {
  constructor(providerId: OAuthProviderId) {
    super(
      `No LearnSynaptic account is linked to this ${providerId} identity. Ask an admin to invite you, then connect ${providerId} from Security Settings.`,
    );
    this.name = "OAuthAccountNotLinkedError";
  }
}

/** Login intent, the provider identity resolved to a real linked
 *  OAuthAccount, but the User it belongs to is disabled. Mirrors
 *  authService.login()'s own inactive-account handling. */
export class OAuthAccountDisabledError extends Error {
  constructor() {
    super("This account is disabled.");
    this.name = "OAuthAccountDisabledError";
  }
}

/** Link intent, but this exact provider identity (provider +
 *  providerAccountId — the model's own unique index) is already linked
 *  to a DIFFERENT LearnSynaptic user. Never silently re-links it —
 *  that would let one user hijack another's OAuth sign-in path. */
export class OAuthAccountAlreadyLinkedError extends Error {
  constructor(providerId: OAuthProviderId) {
    super(`This ${providerId} account is already linked to a different LearnSynaptic user.`);
    this.name = "OAuthAccountAlreadyLinkedError";
  }
}

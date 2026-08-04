/**
 * RC-1 — Single source of truth for Social Login (Google / Microsoft /
 * GitHub) OAuth app credentials. Deliberately a SEPARATE file/env-var
 * namespace from config/calendar.ts's GOOGLE_OAUTH_CONFIG /
 * MICROSOFT_OAUTH_CONFIG, even though both talk to the same vendors:
 * calendar's OAuth apps are per-organization-admin "connect YOUR
 * calendar for scheduling" grants (Calendars.ReadWrite scope, a
 * different redirect URI, tokens stored per-organization); this file's
 * OAuth apps are platform-wide "log in to LearnSynaptic" identity
 * grants (openid/email/profile scope only, tokens used once to fetch a
 * profile and then discarded — see oauthService.ts). Reusing one OAuth
 * app/client-secret for both purposes would conflate two different
 * trust boundaries and consent screens; a real deployment registers two
 * separate OAuth apps in the Google/Microsoft developer console, one
 * per purpose.
 *
 * "Do NOT hardcode providers" (the mission's own words): which
 * providers actually show a "Sign in with X" button is entirely
 * env-driven — see oauth/registry.ts's isOAuthProviderConfigured(), not
 * a hardcoded list here or in any UI component.
 */

export const AUTH_GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.AUTH_GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET || "",
  /** Must exactly match a redirect URI registered on this OAuth app's
   *  own Google Cloud consent screen — e.g.
   *  https://yourdomain.com/api/auth/oauth/google/callback */
  redirectUri: process.env.AUTH_GOOGLE_REDIRECT_URI || "",
};

export const AUTH_MICROSOFT_OAUTH_CONFIG = {
  clientId: process.env.AUTH_MICROSOFT_CLIENT_ID || "",
  clientSecret: process.env.AUTH_MICROSOFT_CLIENT_SECRET || "",
  redirectUri: process.env.AUTH_MICROSOFT_REDIRECT_URI || "",
  /** "common" allows both work/school and personal Microsoft accounts —
   *  the same documented default config/calendar.ts's own Microsoft
   *  config uses. */
  tenantId: process.env.AUTH_MICROSOFT_TENANT_ID || "common",
};

/** GitHub — named in the mission as "optional architecture." Real
 *  adapter (github.provider.ts), gated the identical way Google/
 *  Microsoft are: absent credentials simply means
 *  isOAuthProviderConfigured("github") returns false and no "Sign in
 *  with GitHub" button is ever shown — not a stub that throws if
 *  someone actually configures it. */
export const AUTH_GITHUB_OAUTH_CONFIG = {
  clientId: process.env.AUTH_GITHUB_CLIENT_ID || "",
  clientSecret: process.env.AUTH_GITHUB_CLIENT_SECRET || "",
  redirectUri: process.env.AUTH_GITHUB_REDIRECT_URI || "",
};

/** Signs the OAuth `state` param (oauth/state.ts) — CSRF protection for
 *  the authorize→callback round trip, and the carrier for the
 *  login-vs-link intent (see state.ts's own doc comment). Reuses
 *  getMfaEncryptionSecret's sibling secret pattern: a real server
 *  secret, distinct from every other module's own, falling back to a
 *  clearly-labeled dev-only value rather than throwing at import time —
 *  the same posture every optional-in-dev secret in this app takes. */
export function getIdentityOAuthStateSecret(): string {
  return process.env.AUTH_OAUTH_STATE_SECRET || "dev-only-insecure-identity-oauth-state-secret-32b";
}

/**
 * Single source of truth for Calendar & Meeting Connectors (Phase 6,
 * Module 6.3) OAuth app credentials — server-only, never NEXT_PUBLIC_*,
 * the same "one exported const object, process.env.X || '' per field"
 * shape config/storage.ts / config/whatsapp.ts already established.
 *
 * Unlike Storage's single STORAGE_PROVIDER selector, every calendar
 * provider is independently connectable through the Integrations
 * Registry (Module 6.1) — there's no "one active provider" env var
 * here. Instead, each of the three real OAuth apps below is shared by
 * the catalog entries that reuse the same vendor account:
 *   - GOOGLE_OAUTH_CONFIG   → "google_calendar" and "google_meet"
 *     (Meet links are created through the Calendar API's own
 *     conferenceData field, not a separate Google Meet API — one
 *     Google Cloud OAuth app/consent screen covers both).
 *   - MICROSOFT_OAUTH_CONFIG → "microsoft_outlook_calendar" and
 *     "microsoft_teams_meetings" (both go through Microsoft Graph
 *     using the same Azure AD app registration — Teams links come from
 *     Graph's own onlineMeeting fields on a calendar event).
 *   - ZOOM_OAUTH_CONFIG → "zoom" only (Zoom's own separate OAuth app
 *     and REST API, unrelated to Google/Microsoft).
 *
 * Every provider is additionally gated through the Integrations
 * Registry exactly like Module 6.2's aws_s3/cloudinary: an OAuth app
 * being configured here only makes the "Connect via {Provider}" button
 * functional — calendarService still requires the resulting
 * IntegrationConnection to show connected+enabled before it will place
 * a single real API call (see calendarService.ts's own
 * assertProviderReady()).
 */

export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
  /** Must exactly match a redirect URI registered on the Google Cloud
   *  OAuth consent screen — e.g.
   *  https://yourdomain.com/api/admin/integrations/google_calendar/oauth/callback */
  redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || "",
};

export const MICROSOFT_OAUTH_CONFIG = {
  clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID || "",
  clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET || "",
  redirectUri: process.env.MICROSOFT_OAUTH_REDIRECT_URI || "",
  /** Azure AD tenant to authenticate against — "common" (the real,
   *  documented Microsoft identity platform default) allows both work/
   *  school and personal Microsoft accounts, the safe default for a
   *  SaaS app that doesn't know its customers' tenants in advance. */
  tenantId: process.env.MICROSOFT_OAUTH_TENANT_ID || "common",
};

export const ZOOM_OAUTH_CONFIG = {
  clientId: process.env.ZOOM_OAUTH_CLIENT_ID || "",
  clientSecret: process.env.ZOOM_OAUTH_CLIENT_SECRET || "",
  redirectUri: process.env.ZOOM_OAUTH_REDIRECT_URI || "",
};

/** AES-256-GCM key for encrypting OAuth access/refresh tokens at rest
 *  (tokenCrypto.ts) — a real server secret, distinct from
 *  JWT_ACCESS_TOKEN_SECRET (that one signs this app's own session
 *  tokens; reusing it for a different cryptographic purpose would be
 *  poor key hygiene, unlike Module 6.2's signedUrl.ts, which reuses
 *  JWT_ACCESS_TOKEN_SECRET for a same-purpose HMAC). Falls back to a
 *  clearly-labeled dev-only value rather than throwing at import time —
 *  same "fail loud in production, not at boot" posture every other
 *  optional-in-dev secret in this app already takes. */
export function getCalendarTokenEncryptionSecret(): string {
  return process.env.CALENDAR_TOKEN_ENCRYPTION_SECRET || "dev-only-insecure-calendar-token-secret-32b";
}

/** Signs the OAuth `state` param (oauthState.ts) — CSRF protection for
 *  the authorize→callback round trip. Reuses the same encryption
 *  secret rather than adding a fourth env var for one small, same-
 *  trust-level purpose. */
export function getOAuthStateSecret(): string {
  return getCalendarTokenEncryptionSecret();
}

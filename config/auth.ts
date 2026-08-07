/**
 * Single source of truth for authentication configuration. Server-only —
 * never NEXT_PUBLIC_* — a signing secret must never reach the client
 * bundle (see config/whatsapp.ts for the same reasoning applied to
 * provider credentials).
 *
 * JWT_ACCESS_TOKEN_SECRET is handled differently from every other
 * optional credential in this codebase (WhatsApp/Marketing config all
 * fall back to a safe no-op provider when unset). A JWT secret has no
 * safe no-op: falling back to a hardcoded default string would be a real
 * vulnerability if a deployment ever forgot to set the env var — anyone
 * could forge an admin token. So instead of a static fallback, an unset
 * secret generates a random one per process start (logged loudly below).
 * The app still never fails to build or start, but tokens issued by one
 * process won't verify against another until a real secret is
 * configured — the correct forcing function for a real deployment,
 * rather than a silent, exploitable default.
 *
 * Uses the Web Crypto API (globalThis.crypto), not node:crypto — this
 * file is imported from middleware.ts, which runs on Next.js's Edge
 * runtime and doesn't have node:crypto available. Web Crypto is present
 * in both the Node and Edge runtimes, so this stays portable.
 */

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function resolveAccessTokenSecret(): string {
  const configured = process.env.JWT_ACCESS_TOKEN_SECRET;
  if (configured && configured.length >= 32) return configured;

  if (configured) {
    console.warn(
      "[config/auth] JWT_ACCESS_TOKEN_SECRET is set but shorter than 32 characters — " +
        "ignoring it and generating a random per-process secret instead. Set a longer secret before deploying.",
    );
  } else {
    console.warn(
      "[config/auth] JWT_ACCESS_TOKEN_SECRET is not set — generating a random per-process " +
        "secret. Tokens will not verify across restarts or multiple instances. Set this env " +
        "var before deploying.",
    );
  }
  return randomHex(32);
}

export const JWT_ACCESS_TOKEN_SECRET = resolveAccessTokenSecret();

export const JWT_ACCESS_TOKEN_TTL_SECONDS = Number(process.env.JWT_ACCESS_TOKEN_TTL_SECONDS) || 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS) || 30 * 24 * 60 * 60;
/** RC-1 — "Remember Me" unchecked gets this shorter session lifetime
 *  instead of the full 30-day default above — long enough for a normal
 *  workday-to-workday gap, short enough that a shared/public device
 *  doesn't stay signed in for a month. */
export const REFRESH_TOKEN_TTL_SECONDS_SHORT = Number(process.env.REFRESH_TOKEN_TTL_SECONDS_SHORT) || 12 * 60 * 60;

/** RC-1 — self-service password reset / email verification links.
 *  Short-lived by design (OWASP guidance for single-use tokens sent by
 *  email, which can sit in an inbox or be forwarded). */
export const PASSWORD_RESET_TOKEN_TTL_SECONDS = Number(process.env.PASSWORD_RESET_TOKEN_TTL_SECONDS) || 60 * 60;
export const EMAIL_VERIFICATION_TOKEN_TTL_SECONDS = Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_SECONDS) || 24 * 60 * 60;
/** RC-7 — Customer Onboarding & SaaS Activation. Longer than a
 *  password-reset link (7 days vs. 1 hour) — an invitation is
 *  typically addressed to someone who isn't actively waiting for it
 *  the way a person who just clicked "forgot password" is; OWASP's own
 *  guidance for invite-style tokens allows a longer window than a
 *  security-recovery one. */
export const TEAM_INVITATION_TTL_SECONDS = Number(process.env.TEAM_INVITATION_TTL_SECONDS) || 7 * 24 * 60 * 60;

/** RC-1 — brute-force lockout. 5 failed attempts is OWASP's own commonly
 *  cited starting point for a staff/admin login (not a high-volume
 *  consumer signup form); 15 minutes is long enough to make automated
 *  guessing impractical without permanently locking out a real user who
 *  mistyped their password a few times. */
export const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS) || 5;
export const LOCKOUT_DURATION_SECONDS = Number(process.env.LOCKOUT_DURATION_SECONDS) || 15 * 60;

/** RC-1 — MFA email-OTP code lifetime, and how long a device that
 *  completed MFA once can skip it on subsequent logins. */
export const MFA_EMAIL_OTP_TTL_SECONDS = Number(process.env.MFA_EMAIL_OTP_TTL_SECONDS) || 10 * 60;
export const MFA_TRUSTED_DEVICE_TTL_SECONDS = Number(process.env.MFA_TRUSTED_DEVICE_TTL_SECONDS) || 30 * 24 * 60 * 60;
export const AUTH_MFA_TRUSTED_DEVICE_COOKIE_NAME = "ls_mfa_trusted_device";

/** RC-1 — AES-256-GCM key for encrypting each user's own TOTP shared
 *  secret at rest (mfaCrypto.ts) — a real server secret, deliberately
 *  distinct from every other module's own encryption secret
 *  (TENANT_CREDENTIAL_ENCRYPTION_SECRET, CALENDAR_TOKEN_ENCRYPTION_SECRET,
 *  WEBHOOK_SECRET_ENCRYPTION_SECRET), the same "don't reuse one secret
 *  across unrelated cryptographic purposes" key hygiene this codebase
 *  has held since Module 6.3. Falls back to a clearly-labeled dev-only
 *  value rather than throwing at import time, the same posture every
 *  other optional encryption secret in this app already takes. */
export function getMfaEncryptionSecret(): string {
  return process.env.MFA_ENCRYPTION_SECRET || "dev-only-insecure-mfa-secret-key-32b";
}

export const AUTH_ACCESS_COOKIE_NAME = "ls_access_token";
export const AUTH_REFRESH_COOKIE_NAME = "ls_refresh_token";

/** Refresh cookie is scoped to /api/auth (not "/") — it's only ever read
 *  by the refresh/logout endpoints, so it's never sent on ordinary
 *  requests. The access cookie needs path "/" — middleware checks it on
 *  every protected request. */
export const AUTH_REFRESH_COOKIE_PATH = "/api/auth";

/** Defaults to secure-cookies-only in production; overridable for
 *  environments (e.g. an internal HTTP-only staging box) that need to
 *  opt out explicitly rather than by accident. Never defaults to
 *  insecure in production silently. */
export const AUTH_COOKIE_SECURE =
  process.env.AUTH_COOKIE_SECURE !== undefined
    ? process.env.AUTH_COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";

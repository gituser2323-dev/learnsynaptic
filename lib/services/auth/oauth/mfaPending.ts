import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getIdentityOAuthStateSecret } from "@/config/identityOAuth";

/**
 * RC-1 — Social Login × MFA. A normal password login can carry an
 * `mfaCode` in the SAME request that verifies the password (see
 * authService.login()'s own doc comment) because the browser posts a
 * form. An OAuth callback has no such second field to piggyback on —
 * the provider redirects back with only `code`/`state`, and by the time
 * oauthService.ts resolves that to a real, MFA-enabled User, the
 * request is already mid-redirect with nothing left to prompt for.
 *
 * So a user with MFA enabled who signs in via OAuth gets a short-lived
 * "you just proved you own this provider identity, now prove the second
 * factor" pending token instead of real session tokens — the callback
 * route redirects the browser to the login page's own MFA-entry step
 * with this token attached, and POST /api/auth/oauth/mfa/verify
 * redeems it together with a real code.
 *
 * Deliberately a stateless, HMAC-signed token (like oauth/state.ts's own
 * CSRF state) rather than a new DB-backed single-use grant: unlike a
 * password-reset or refresh token, presenting this token alone grants
 * nothing — it only proves "a real OAuth login for this specific userId
 * already completed," and the caller still has to separately supply a
 * correct MFA code (verified via mfaService.verifyCode(), the exact
 * same TOTP/recovery/email-OTP chain login() itself uses) before any
 * session is issued. A short (5-minute) TTL bounds the value of a
 * captured-but-unused token; skipping single-use invalidation here is
 * an accepted, narrow tradeoff to avoid a new collection for a
 * short-lived intermediate credential of intentionally low value.
 */

const PENDING_TTL_SECONDS = 5 * 60;

function sign(userId: string, providerId: string, nonce: string, expiresAt: number): string {
  return createHmac("sha256", getIdentityOAuthStateSecret())
    .update(`oauth_mfa_pending:${userId}:${providerId}:${nonce}:${expiresAt}`)
    .digest("hex");
}

/** Binds the provider that actually completed the token exchange, not
 *  just the userId — a defense-in-depth check (verifyOAuthMfaPendingToken
 *  rejects a mismatched provider) that keeps the eventual audit-log
 *  `authMethod` tag (e.g. "oauth:google") honest even though the real
 *  security decision, the MFA code itself, doesn't depend on it. */
export function createOAuthMfaPendingToken(userId: string, providerId: string): string {
  const nonce = randomBytes(16).toString("base64url");
  const expiresAt = Date.now() + PENDING_TTL_SECONDS * 1000;
  const signature = sign(userId, providerId, nonce, expiresAt);
  return Buffer.from(JSON.stringify({ userId, providerId, nonce, expiresAt, signature })).toString("base64url");
}

/** Returns the verified userId, or null if malformed/expired/tampered/
 *  presented with a providerId different from the one it was issued
 *  for. */
export function verifyOAuthMfaPendingToken(token: string, providerId: string): string | null {
  let parsed: { userId?: unknown; providerId?: unknown; nonce?: unknown; expiresAt?: unknown; signature?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const { userId, providerId: tokenProviderId, nonce, expiresAt, signature } = parsed;
  if (
    typeof userId !== "string" ||
    typeof tokenProviderId !== "string" ||
    typeof nonce !== "string" ||
    typeof expiresAt !== "number" ||
    typeof signature !== "string"
  ) {
    return null;
  }
  if (tokenProviderId !== providerId) return null;
  if (Date.now() > expiresAt) return null;

  const expected = sign(userId, tokenProviderId, nonce, expiresAt);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  return userId;
}

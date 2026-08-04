import { generateOpaqueToken, hashOpaqueToken } from "./opaqueToken";

/**
 * Refresh-token generation/hashing — thin, refresh-token-named wrappers
 * over opaqueToken.ts's own generic primitive (RC-1 extracted the
 * shared crypto there so password-reset/email-verification/MFA-
 * trusted-device tokens could reuse it too, without duplicating this
 * exact logic four times). Kept as its own file/name for the existing
 * call sites and doc-comment clarity: this is Node-runtime only
 * (node:crypto, via opaqueToken.ts), only ever imported by
 * authService.ts, which only runs from Route Handlers (Node runtime) —
 * login/refresh/logout, never middleware.ts (Edge runtime).
 */

/** A cryptographically random, URL-safe opaque token — not a JWT. See
 *  types.ts's module doc for why refresh tokens aren't encoded as JWTs. */
export function generateRefreshToken(): string {
  return generateOpaqueToken();
}

/** SHA-256 of the raw token, hex-encoded — the only form ever persisted
 *  (RefreshTokenRecord.tokenHash). */
export function hashRefreshToken(rawToken: string): string {
  return hashOpaqueToken(rawToken);
}

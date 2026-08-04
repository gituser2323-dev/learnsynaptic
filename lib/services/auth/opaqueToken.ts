import { randomBytes, createHash } from "crypto";

/**
 * RC-1 — the generic "opaque random bearer token, only its hash ever
 * persisted" primitive refreshTokenCrypto.ts already established for
 * refresh tokens (Module 9), extracted here so password-reset tokens,
 * email-verification tokens, and MFA trusted-device tokens can reuse
 * the EXACT same crypto rather than each hand-rolling their own copy.
 * Node-runtime only (node:crypto) — never imported from middleware.ts
 * or anything Edge-runtime-bound, same constraint refreshTokenCrypto.ts
 * already documents.
 */

/** A cryptographically random, URL-safe opaque token — 256 bits of
 *  entropy, the same size every token-shaped credential in this app
 *  already uses (refresh tokens, signed URLs). Precomputation/
 *  rainbow-table attacks are infeasible against this without a pepper,
 *  so none is used — same "don't add unneeded complexity" call
 *  refreshTokenCrypto.ts's own doc comment already made. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 of the raw token, hex-encoded — the only form ever
 *  persisted. */
export function hashOpaqueToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

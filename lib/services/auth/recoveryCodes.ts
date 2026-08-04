import { randomInt, createHash } from "crypto";

/**
 * RC-1 — MFA recovery codes: 10 single-use codes issued whenever MFA is
 * enabled (or explicitly regenerated), for the "I lost my authenticator
 * app" recovery path. Human-typeable by design (unlike a refresh/reset
 * token) — `XXXX-XXXX` from a 32-character alphabet that deliberately
 * excludes visually-ambiguous characters (0/O, 1/I/L) so a code read
 * off a printed backup sheet or a password manager note doesn't fail to
 * verify from a transcription mistake. Only the SHA-256 hash of each
 * code is ever persisted (MfaRecoveryCodeRepository), the same "opaque
 * credential, only its hash stored" invariant every other token-shaped
 * secret in this app already upholds — the plaintext codes are shown to
 * the user exactly once, at generation time.
 */

const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_COUNT = 10;

function randomCode(): string {
  const chars = Array.from({ length: 8 }, () => RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: CODE_COUNT }, randomCode);
}

/** Normalizes a user-typed code before hashing (case-insensitive,
 *  tolerates the dash being omitted or extra whitespace) so a real
 *  human retyping a printed code isn't rejected over formatting. */
export function normalizeRecoveryCode(input: string): string {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 8) return input.toUpperCase().trim();
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

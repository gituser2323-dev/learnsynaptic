import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getCalendarTokenEncryptionSecret } from "@/config/calendar";

/**
 * Calendar & Meeting Connectors (Module 6.3) — real, reversible
 * encryption for OAuth access/refresh tokens at rest. Deliberately NOT
 * a hash (unlike lib/services/auth/refreshTokenCrypto.ts's
 * hashRefreshToken()): this app's own refresh tokens only ever need to
 * be *verified* by comparison, but an OAuth token must be *recovered*
 * later to make a real call to Google/Microsoft/Zoom — a one-way hash
 * can't serve that purpose, so this module needs its own primitive,
 * not a reuse of that one.
 *
 * AES-256-GCM: authenticated encryption (a tampered ciphertext fails
 * to decrypt rather than silently returning garbage), the standard,
 * well-vetted choice for exactly this "encrypt a secret at rest"
 * problem — Node's own `crypto` module, no external dependency, the
 * same "use a real, standard primitive directly" precedent
 * signedUrl.ts's HMAC-SHA256 already set for Module 6.2.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard GCM nonce size.

function deriveKey(): Buffer {
  // SHA-256 of the configured secret — gives a fixed 32-byte key
  // regardless of the secret's own length, the same "hash an arbitrary
  // env string down to the primitive's required size" approach this
  // codebase already uses (e.g. HMAC secrets need no fixed length,
  // AES-256 keys do).
  return createHash("sha256").update(getCalendarTokenEncryptionSecret()).digest();
}

/** Returns `${iv}:${authTag}:${ciphertext}`, each base64url-encoded — a
 *  plain, inspectable format (not a fancy binary encoding), matching
 *  signedUrl.ts's own "readable, self-describing" precedent. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

/** Throws if the ciphertext is malformed or was encrypted under a
 *  different key/secret — GCM's auth tag makes tampering and
 *  wrong-key attempts both fail loudly rather than returning garbage
 *  plaintext, deliberately never caught-and-swallowed here (the caller
 *  decides whether "token unreadable" means "surface a clear error" or
 *  "treat this connection as broken" — see calendarService.ts). */
export function decryptToken(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted token.");
  const [ivPart, authTagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

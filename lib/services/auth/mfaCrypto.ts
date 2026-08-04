import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getMfaEncryptionSecret } from "@/config/auth";

/**
 * RC-1 — real, reversible encryption for a user's own TOTP shared
 * secret at rest. The same AES-256-GCM shape this codebase already
 * copies per-module for a genuinely distinct secret purpose
 * (credentialCrypto.ts/tokenCrypto.ts/secretCrypto.ts precedent) — this
 * is that pattern's sixth independent copy, never a shared helper (see
 * credentialCrypto.ts's own doc comment for why this project prefers
 * that over one shared crypto module).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(): Buffer {
  return createHash("sha256").update(getMfaEncryptionSecret()).digest();
}

/** Returns `${iv}:${authTag}:${ciphertext}`, each base64url-encoded. */
export function encryptMfaSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

/** Throws on a malformed or wrong-key ciphertext — GCM's auth tag makes
 *  tampering fail loudly rather than returning garbage. */
export function decryptMfaSecret(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted MFA secret.");
  const [ivPart, authTagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

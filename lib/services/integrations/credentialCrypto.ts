import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getTenantCredentialEncryptionSecret } from "@/config/tenantCredentials";

/**
 * Business OS Phase 8, Module 8.2 — real, reversible encryption for
 * per-organization provider credentials at rest. The fifth independent
 * copy of this exact AES-256-GCM shape in this codebase
 * (lib/services/calendar/tokenCrypto.ts is the third,
 * lib/services/webhooks/secretCrypto.ts the fourth — both of their own
 * doc comments explain why this project copies the proven pattern
 * locally per module rather than sharing one helper; the identical
 * judgment applies again here).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(): Buffer {
  return createHash("sha256").update(getTenantCredentialEncryptionSecret()).digest();
}

/** Returns `${iv}:${authTag}:${ciphertext}`, each base64url-encoded —
 *  the same plain, inspectable format tokenCrypto.ts/secretCrypto.ts
 *  already use. */
export function encryptCredentialValue(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

/** Throws on a malformed or wrong-key ciphertext — GCM's auth tag
 *  makes tampering fail loudly rather than returning garbage. */
export function decryptCredentialValue(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted credential value.");
  const [ivPart, authTagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Encrypts every value in a plain key→plaintext map — the shape a
 *  connect-credentials request body carries (e.g.
 *  `{apiKey: "sk-...", accountId: "123"}`). Keys are provider-specific
 *  generic credential-field names, never encrypted themselves (they're
 *  not secret — "apiKey" as a label leaks nothing). */
export function encryptCredentialValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, encryptCredentialValue(value)]));
}

/** The read side of encryptCredentialValues — used by the resolver,
 *  never by anything that could return the result to a client. */
export function decryptCredentialValues(encrypted: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(encrypted).map(([key, value]) => [key, decryptCredentialValue(value)]));
}

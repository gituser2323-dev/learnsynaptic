import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getWebhookSecretEncryptionSecret } from "@/config/webhooks";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — real,
 * reversible encryption for webhook endpoint secrets and
 * Slack/Teams/Discord webhook URLs at rest. The fourth independent
 * copy of this exact AES-256-GCM shape in this codebase
 * (lib/services/calendar/tokenCrypto.ts is the third, and its own doc
 * comment explains why this project copies the proven pattern locally
 * per module rather than sharing one helper — the identical judgment
 * applies again here: a shared `lib/security/hmac.ts` would only ever
 * have one real caller today, so extracting one now is speculative
 * generalization, not yet-needed reuse).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(): Buffer {
  return createHash("sha256").update(getWebhookSecretEncryptionSecret()).digest();
}

/** Returns `${iv}:${authTag}:${ciphertext}`, each base64url-encoded —
 *  the same plain, inspectable format tokenCrypto.ts already uses. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

/** Throws on a malformed or wrong-key ciphertext — GCM's auth tag
 *  makes tampering fail loudly rather than returning garbage. */
export function decryptSecret(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted secret.");
  const [ivPart, authTagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** A real, cryptographically random webhook signing secret — used
 *  when an admin registers an endpoint without supplying their own. */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("base64url");
}

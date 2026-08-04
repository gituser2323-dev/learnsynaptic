import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, generateWebhookSecret } from "./secretCrypto";

describe("secretCrypto — AES-256-GCM encrypt/decrypt for webhook secrets and notification webhook URLs at rest", () => {
  it("round-trips: a freshly encrypted secret decrypts back to the original plaintext", () => {
    const plaintext = "whsec_a_real_looking_signing_secret";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext every call (random IV), even for the same plaintext", () => {
    const a = encryptSecret("same-secret");
    const b = encryptSecret("same-secret");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-secret");
    expect(decryptSecret(b)).toBe("same-secret");
  });

  it("rejects a tampered ciphertext — GCM's auth tag catches it rather than returning garbage", () => {
    const encrypted = encryptSecret("a-real-secret");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tamperedCiphertext = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === "AA" ? "BB" : "AA");
    expect(() => decryptSecret([iv, authTag, tamperedCiphertext].join(":"))).toThrow();
  });

  it("rejects a malformed (non-3-part) encoded string", () => {
    expect(() => decryptSecret("not-a-real-encrypted-secret")).toThrow("Malformed encrypted secret.");
  });

  it("round-trips a real webhook URL (Slack/Teams/Discord's own credential shape)", () => {
    const url = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX";
    expect(decryptSecret(encryptSecret(url))).toBe(url);
  });
});

describe("generateWebhookSecret — real, random signing secret generation", () => {
  it("generates a non-empty, sufficiently long, unique value every call", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("generated secrets satisfy validation.ts's own minimum-length rule (>= 16 chars)", () => {
    expect(generateWebhookSecret().length).toBeGreaterThanOrEqual(16);
  });
});

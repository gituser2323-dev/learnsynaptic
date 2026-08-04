import { describe, it, expect } from "vitest";
import { encryptCredentialValue, decryptCredentialValue, encryptCredentialValues, decryptCredentialValues } from "./credentialCrypto";

describe("credentialCrypto", () => {
  it("round-trips a plaintext value through encrypt/decrypt", () => {
    const encrypted = encryptCredentialValue("sk-live-super-secret-123");
    expect(encrypted).not.toContain("sk-live-super-secret-123");
    expect(decryptCredentialValue(encrypted)).toBe("sk-live-super-secret-123");
  });

  it("produces a different ciphertext for the same plaintext on each call (random IV)", () => {
    const a = encryptCredentialValue("same-value");
    const b = encryptCredentialValue("same-value");
    expect(a).not.toBe(b);
    expect(decryptCredentialValue(a)).toBe("same-value");
    expect(decryptCredentialValue(b)).toBe("same-value");
  });

  it("throws on a tampered ciphertext rather than returning garbage", () => {
    const encrypted = encryptCredentialValue("tamper-me");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = [iv, authTag, ciphertext.slice(0, -2) + (ciphertext.slice(-2) === "AA" ? "BB" : "AA")].join(":");
    expect(() => decryptCredentialValue(tampered)).toThrow();
  });

  it("throws on a malformed (non-3-part) encoded value", () => {
    expect(() => decryptCredentialValue("not-a-real-encoded-value")).toThrow();
  });

  it("encrypts and decrypts a whole key-value map", () => {
    const values = { apiKey: "key-123", accountId: "acct-456" };
    const encrypted = encryptCredentialValues(values);
    expect(encrypted.apiKey).not.toBe("key-123");
    expect(encrypted.accountId).not.toBe("acct-456");
    expect(decryptCredentialValues(encrypted)).toEqual(values);
  });
});

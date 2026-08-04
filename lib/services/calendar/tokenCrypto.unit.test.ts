import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "./tokenCrypto";

describe("tokenCrypto — AES-256-GCM encrypt/decrypt for OAuth tokens at rest", () => {
  it("round-trips: a freshly encrypted token decrypts back to the original plaintext", () => {
    const plaintext = "ya29.a0AfH6SMB_real_looking_access_token_value";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext every call (random IV), even for the same plaintext", () => {
    const a = encryptToken("same-token");
    const b = encryptToken("same-token");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same-token");
    expect(decryptToken(b)).toBe("same-token");
  });

  it("rejects a tampered ciphertext — GCM's auth tag catches it rather than returning garbage", () => {
    const encrypted = encryptToken("a-real-token");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tamperedCiphertext = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === "AA" ? "BB" : "AA");
    expect(() => decryptToken([iv, authTag, tamperedCiphertext].join(":"))).toThrow();
  });

  it("rejects a malformed (non-3-part) encoded string", () => {
    expect(() => decryptToken("not-a-real-encrypted-token")).toThrow("Malformed encrypted token.");
  });

  it("handles an empty-string plaintext", () => {
    const encrypted = encryptToken("");
    expect(decryptToken(encrypted)).toBe("");
  });
});

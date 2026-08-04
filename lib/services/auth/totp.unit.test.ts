import { describe, it, expect } from "vitest";
import { encodeBase32, generateTotpSecret, generateTotp, verifyTotp, buildTotpUri } from "./totp";

/**
 * RC-1 — MFA (TOTP). RFC 6238 Appendix B publishes known-answer test
 * vectors for the SHA-1 case using the ASCII secret
 * "12345678901234567890" (20 bytes) — verifying against the PUBLISHED
 * spec vector (not just "generate then verify with our own code") is
 * the real correctness bar for a hand-rolled crypto primitive.
 */
const RFC_TEST_SECRET_BASE32 = encodeBase32(Buffer.from("12345678901234567890", "ascii"));

describe("totp — RFC 6238 Appendix B test vectors (SHA-1)", () => {
  it("produces the published 8-digit-truncated-to-6 code at T=59s (counter=1)", () => {
    // RFC 6238's own vector at T=59 is "94287082" (8 digits, HOTP with
    // 8-digit truncation); this implementation always reduces mod 10^6,
    // so the last 6 digits of the RFC's own published value are the
    // correct comparison for a 6-digit TOTP at the same T0/step/HMAC.
    const code = generateTotp(RFC_TEST_SECRET_BASE32, 59);
    expect(code).toBe("287082");
  });

  it("produces the published code at T=1111111109s (counter=37037036)", () => {
    const code = generateTotp(RFC_TEST_SECRET_BASE32, 1111111109);
    expect(code).toBe("081804");
  });

  it("produces the published code at T=1111111111s (counter=37037037)", () => {
    const code = generateTotp(RFC_TEST_SECRET_BASE32, 1111111111);
    expect(code).toBe("050471");
  });

  it("produces the published code at T=1234567890s (counter=41152263)", () => {
    const code = generateTotp(RFC_TEST_SECRET_BASE32, 1234567890);
    expect(code).toBe("005924");
  });
});

describe("verifyTotp — drift tolerance and rejection", () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000; // arbitrary fixed epoch second, step-aligned math only.

  it("accepts the exact current-step code", () => {
    const code = generateTotp(secret, now);
    expect(verifyTotp(secret, code, now)).toBe(true);
  });

  it("accepts a code from one step earlier (clock drift tolerance)", () => {
    const code = generateTotp(secret, now - 30);
    expect(verifyTotp(secret, code, now)).toBe(true);
  });

  it("accepts a code from one step later (clock drift tolerance)", () => {
    const code = generateTotp(secret, now + 30);
    expect(verifyTotp(secret, code, now)).toBe(true);
  });

  it("rejects a code two steps away (outside the drift window)", () => {
    const code = generateTotp(secret, now - 60);
    expect(verifyTotp(secret, code, now)).toBe(false);
  });

  it("rejects a well-formed but wrong code", () => {
    const real = generateTotp(secret, now);
    const wrong = real === "000000" ? "111111" : "000000";
    expect(verifyTotp(secret, wrong, now)).toBe(false);
  });

  it("rejects non-6-digit input outright (letters, wrong length)", () => {
    expect(verifyTotp(secret, "abcdef", now)).toBe(false);
    expect(verifyTotp(secret, "12345", now)).toBe(false);
    expect(verifyTotp(secret, "1234567", now)).toBe(false);
  });

  it("rejects a code generated under a completely different secret", () => {
    const otherSecret = generateTotpSecret();
    const code = generateTotp(otherSecret, now);
    expect(verifyTotp(secret, code, now)).toBe(false);
  });
});

describe("generateTotpSecret / buildTotpUri", () => {
  it("generates a base32 secret with no padding characters", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it("generates a different secret on every call", () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });

  it("builds a valid otpauth:// URI carrying the secret, issuer, and account", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, "person@example.com", "LearnSynaptic");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain("issuer=LearnSynaptic");
    expect(decodeURIComponent(uri)).toContain("LearnSynaptic:person@example.com");
  });
});

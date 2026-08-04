import { describe, it, expect } from "vitest";
import { generateRecoveryCodes, normalizeRecoveryCode, hashRecoveryCode } from "./recoveryCodes";

describe("generateRecoveryCodes", () => {
  it("generates exactly 10 codes in XXXX-XXXX format from the unambiguous alphabet", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      // Never contains the visually-ambiguous characters explicitly excluded.
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it("generates all-distinct codes within one batch", () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
  });

  it("generates a different batch on every call", () => {
    const a = generateRecoveryCodes();
    const b = generateRecoveryCodes();
    expect(a).not.toEqual(b);
  });
});

describe("normalizeRecoveryCode", () => {
  it("is idempotent on an already-correctly-formatted code", () => {
    expect(normalizeRecoveryCode("ABCD-2345")).toBe("ABCD-2345");
  });

  it("uppercases a lowercase-typed code", () => {
    expect(normalizeRecoveryCode("abcd-2345")).toBe("ABCD-2345");
  });

  it("re-inserts the dash when the user omits it", () => {
    expect(normalizeRecoveryCode("ABCD2345")).toBe("ABCD-2345");
  });

  it("tolerates stray whitespace around the code", () => {
    expect(normalizeRecoveryCode("  abcd-2345  ")).toBe("ABCD-2345");
  });
});

describe("hashRecoveryCode", () => {
  it("produces the same hash for equivalent input formats (case/dash-insensitive)", () => {
    const a = hashRecoveryCode("ABCD-2345");
    const b = hashRecoveryCode("abcd2345");
    const c = hashRecoveryCode("  AbCd-2345  ");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("produces a 64-character hex SHA-256 digest", () => {
    expect(hashRecoveryCode("ABCD-2345")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different codes", () => {
    expect(hashRecoveryCode("ABCD-2345")).not.toBe(hashRecoveryCode("WXYZ-6789"));
  });
});

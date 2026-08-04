import { describe, it, expect } from "vitest";
import { contrastRatio, validateBrandColor, isValidHexColor, deriveAccentShades } from "./contrast";

describe("contrastRatio — real WCAG relative-luminance formula", () => {
  it("white vs. black is exactly 21:1, the maximum possible ratio", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("a color against itself is always 1:1", () => {
    expect(contrastRatio("#6366f1", "#6366f1")).toBeCloseTo(1, 5);
  });

  it("is symmetric — argument order never changes the result", () => {
    expect(contrastRatio("#4338ca", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#4338ca"), 10);
  });
});

describe("validateBrandColor — the real accessibility gate", () => {
  it("accepts a color with real, clear contrast margin against both white button text and the dark shell background", () => {
    const result = validateBrandColor("#15803d");
    expect(result.valid).toBe(true);
    expect(result.contrastAgainstWhiteText).toBeGreaterThanOrEqual(4.5);
    expect(result.contrastAgainstShellBackground).toBeGreaterThanOrEqual(3);
  });

  it("rejects a color too light for legible white button text, with a real, specific reason", () => {
    const result = validateBrandColor("#a5b4fc");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/too light/i);
  });

  it("rejects a color that passes white-text contrast but is too close to the dark shell background for a visible focus ring/indicator", () => {
    const result = validateBrandColor("#1d4ed8");
    expect(result.contrastAgainstWhiteText).toBeGreaterThanOrEqual(4.5);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/dashboard's own background/i);
  });

  it("rejects a malformed value outright — not a hex color at all", () => {
    expect(validateBrandColor("not-a-color").valid).toBe(false);
    expect(validateBrandColor("javascript:alert(1)").valid).toBe(false);
    expect(validateBrandColor(123).valid).toBe(false);
    expect(validateBrandColor(undefined).valid).toBe(false);
  });
});

describe("isValidHexColor", () => {
  it("accepts a real 6-digit hex value", () => {
    expect(isValidHexColor("#6366f1")).toBe(true);
  });
  it("rejects a 3-digit shorthand, a missing #, and non-hex characters", () => {
    expect(isValidHexColor("#fff")).toBe(false);
    expect(isValidHexColor("6366f1")).toBe(false);
    expect(isValidHexColor("#zzzzzz")).toBe(false);
  });
});

describe("deriveAccentShades", () => {
  it("derives a lighter hover shade and a low-alpha soft rgba from the same base color", () => {
    const { hover, soft } = deriveAccentShades("#15803d");
    expect(hover).toMatch(/^#[0-9a-f]{6}$/);
    expect(soft).toBe("rgba(21, 128, 61, 0.16)");
    // The hover shade is genuinely lighter than the base — a real
    // derivation, not an accidental no-op.
    expect(contrastRatio(hover, "#ffffff")).toBeLessThan(contrastRatio("#15803d", "#ffffff"));
  });
});

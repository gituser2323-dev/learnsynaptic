/**
 * Business OS Phase 8, Module 8.4 — a real WCAG 2.1 relative-luminance
 * contrast-ratio implementation (the actual published formula, not an
 * approximation), the one gate a tenant-chosen brand color passes
 * through before it's ever accepted. Prevents the mission's own
 * explicit failure mode: "if a tenant selects an unusable color
 * combination, provide a safe fallback or validation rather than
 * rendering inaccessible UI."
 */

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_PATTERN.test(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/** sRGB -> linear-light channel, per the WCAG formula's own defined steps. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const [lr, lg, lb] = [linearize(r), linearize(g), linearize(b)];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** The real WCAG contrast-ratio formula: `(L1+0.05)/(L2+0.05)`, L1 the
 *  lighter of the two. Returns a value in `[1, 21]`. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.1 SC 1.4.3 (normal text) minimum — the threshold for white
 *  button-label text rendered on a brand-colored button background
 *  (this app's own real usage of `--adm-accent`, see globals.css's
 *  `.adm-btn-primary`). */
const MIN_CONTRAST_FOR_BUTTON_TEXT = 4.5;

/** WCAG 2.1 SC 1.4.11 (non-text contrast) minimum — the threshold for
 *  the accent color used as a standalone UI indicator (focus rings,
 *  active-nav markers) against this app's own dark shell background. */
const MIN_CONTRAST_FOR_UI_INDICATOR = 3;

const ADMIN_SHELL_DARK_BG = "#111216";
const WHITE = "#ffffff";

export interface ColorValidationResult {
  valid: boolean;
  reason?: string;
  contrastAgainstWhiteText?: number;
  contrastAgainstShellBackground?: number;
}

/**
 * The one real gate: a candidate brand/accent color must render
 * legible WHITE button text on top of it (buttons are this app's own
 * primary real usage of `--adm-accent`) AND remain visible as a
 * standalone indicator against the dark shell background (focus
 * rings/active markers) — reject rather than silently accept a color
 * that fails either, per the mission's own explicit accessibility
 * requirement.
 */
export function validateBrandColor(hex: unknown): ColorValidationResult {
  if (!isValidHexColor(hex)) {
    return { valid: false, reason: "Color must be a 6-digit hex value, e.g. #6366f1." };
  }
  const contrastAgainstWhiteText = contrastRatio(hex, WHITE);
  const contrastAgainstShellBackground = contrastRatio(hex, ADMIN_SHELL_DARK_BG);

  if (contrastAgainstWhiteText < MIN_CONTRAST_FOR_BUTTON_TEXT) {
    return {
      valid: false,
      reason: `This color is too light — white button text on it would only have a ${contrastAgainstWhiteText.toFixed(2)}:1 contrast ratio (needs at least ${MIN_CONTRAST_FOR_BUTTON_TEXT}:1).`,
      contrastAgainstWhiteText,
      contrastAgainstShellBackground,
    };
  }
  if (contrastAgainstShellBackground < MIN_CONTRAST_FOR_UI_INDICATOR) {
    return {
      valid: false,
      reason: `This color is too close to the dashboard's own background — it would only have a ${contrastAgainstShellBackground.toFixed(2)}:1 contrast ratio as a focus ring or indicator (needs at least ${MIN_CONTRAST_FOR_UI_INDICATOR}:1).`,
      contrastAgainstWhiteText,
      contrastAgainstShellBackground,
    };
  }
  return { valid: true, contrastAgainstWhiteText, contrastAgainstShellBackground };
}

/** Derives a lighter "hover" shade and a low-alpha "soft" background
 *  tint from one base color — this app's own existing `--adm-accent-
 *  hover`/`--adm-accent-soft` tokens are hand-authored constants
 *  alongside `--adm-accent` in globals.css (not CSS `color-mix()`
 *  expressions), so a tenant-chosen override needs the same two
 *  derived values computed for real, not left mismatched against the
 *  new base color. */
export function deriveAccentShades(hex: string): { hover: string; soft: string } {
  const [r, g, b] = hexToRgb(hex);
  const lighten = (channel: number) => Math.min(255, Math.round(channel + (255 - channel) * 0.18));
  const hover = `#${[lighten(r), lighten(g), lighten(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  const soft = `rgba(${r}, ${g}, ${b}, 0.16)`;
  return { hover, soft };
}

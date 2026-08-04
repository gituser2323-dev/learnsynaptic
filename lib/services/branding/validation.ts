import { validateBrandColor } from "./contrast";
import type { UpsertBrandConfigurationInput } from "./types";

export interface BrandingValidationError {
  field: string;
  message: string;
}

const MAX_DISPLAY_NAME = 120;
const MAX_FOOTER_TEXT = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only `http:`/`https:` — rejects `javascript:`/`data:`/any other
 *  scheme a malicious "support URL" could carry, per the mission's own
 *  explicit "unsafe URLs" security requirement. No path-traversal
 *  concern here (this is stored and only ever rendered as an `href`,
 *  never used to read a local file), but a non-http(s) scheme in an
 *  `<a href>` is a real XSS vector this app's own React rendering
 *  wouldn't otherwise stop. */
function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Strips any `<`/`>` outright rather than attempting to allow-list
 *  "safe" tags — `footerText` is always rendered as plain text (email
 *  footers, a future plain-text UI label), never `dangerouslySetInnerHTML`
 *  anywhere in this codebase, so the simplest real defense is refusing
 *  to store anything that LOOKS like markup at all, matching the
 *  mission's own explicit "do NOT allow arbitrary unsafe HTML
 *  injection." */
function containsMarkup(value: string): boolean {
  return /[<>]/.test(value);
}

export function validateUpsertBrandConfiguration(body: unknown): { valid: true; data: UpsertBrandConfigurationInput } | { valid: false; errors: BrandingValidationError[] } {
  if (typeof body !== "object" || body === null) return { valid: false, errors: [{ field: "root", message: "Request body must be an object." }] };
  const b = body as Record<string, unknown>;
  const errors: BrandingValidationError[] = [];
  const data: UpsertBrandConfigurationInput = {};

  if (b.displayName !== undefined) {
    if (b.displayName === null) data.displayName = undefined;
    else if (typeof b.displayName !== "string" || !b.displayName.trim() || b.displayName.length > MAX_DISPLAY_NAME) {
      errors.push({ field: "displayName", message: `displayName must be a non-empty string up to ${MAX_DISPLAY_NAME} characters.` });
    } else if (containsMarkup(b.displayName)) {
      errors.push({ field: "displayName", message: "displayName cannot contain < or > characters." });
    } else {
      data.displayName = b.displayName.trim();
    }
  }

  for (const field of ["logoFileId", "compactLogoFileId", "faviconFileId"] as const) {
    if (b[field] !== undefined) {
      if (b[field] === null) data[field] = null;
      else if (typeof b[field] !== "string" || !b[field].trim()) errors.push({ field, message: `${field} must be a string file id.` });
      else data[field] = (b[field] as string).trim();
    }
  }

  for (const field of ["primaryColor", "accentColor"] as const) {
    if (b[field] !== undefined) {
      if (b[field] === null) {
        data[field] = null;
      } else {
        const validation = validateBrandColor(b[field]);
        if (!validation.valid) errors.push({ field, message: validation.reason ?? "Invalid color." });
        else data[field] = b[field] as string;
      }
    }
  }

  if (b.supportEmail !== undefined) {
    if (b.supportEmail === null) data.supportEmail = null;
    else if (typeof b.supportEmail !== "string" || !EMAIL_RE.test(b.supportEmail.trim())) {
      errors.push({ field: "supportEmail", message: "supportEmail must be a valid email address." });
    } else {
      data.supportEmail = b.supportEmail.trim();
    }
  }

  for (const field of ["supportUrl", "websiteUrl"] as const) {
    if (b[field] !== undefined) {
      if (b[field] === null) {
        data[field] = null;
      } else if (typeof b[field] !== "string" || !isSafeHttpUrl(b[field] as string)) {
        errors.push({ field, message: `${field} must be a real http:// or https:// URL.` });
      } else {
        data[field] = (b[field] as string).trim();
      }
    }
  }

  if (b.footerText !== undefined) {
    if (b.footerText === null) data.footerText = null;
    else if (typeof b.footerText !== "string" || b.footerText.length > MAX_FOOTER_TEXT) {
      errors.push({ field: "footerText", message: `footerText must be a string up to ${MAX_FOOTER_TEXT} characters.` });
    } else if (containsMarkup(b.footerText)) {
      errors.push({ field: "footerText", message: "footerText cannot contain < or > characters." });
    } else {
      data.footerText = b.footerText.trim();
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data };
}

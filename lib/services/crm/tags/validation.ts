import type { CreateTagInput } from "./types";

export interface TagValidationError {
  field: string;
  message: string;
}

export type TagValidationResult =
  | { valid: true; data: CreateTagInput }
  | { valid: false; errors: TagValidationError[] };

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function validateCreateTagInput(input: unknown): TagValidationResult {
  const errors: TagValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) errors.push({ field: "label", message: "Tag label is required." });
  if (label.length > 40) errors.push({ field: "label", message: "Tag label must be 40 characters or fewer." });

  const color = typeof body.color === "string" ? body.color.trim() : "#6366f1";
  if (!HEX_COLOR_RE.test(color)) {
    errors.push({ field: "color", message: "Color must be a hex value, e.g. #6366f1." });
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { label, color } };
}

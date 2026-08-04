import type { CreateCustomFieldDefinitionInput, CustomFieldDefinition, CustomFieldType } from "./types";

export interface CustomFieldValidationError {
  field: string;
  message: string;
}

const VALID_TYPES: CustomFieldType[] = ["text", "number", "date", "dropdown", "checkbox", "radio", "multiselect"];
const OPTIONS_REQUIRED_TYPES: CustomFieldType[] = ["dropdown", "radio", "multiselect"];
const KEY_RE = /^[a-z][a-z0-9_]{1,49}$/;

export type CustomFieldDefinitionValidationResult =
  | { valid: true; data: CreateCustomFieldDefinitionInput }
  | { valid: false; errors: CustomFieldValidationError[] };

export function validateCreateCustomFieldDefinitionInput(input: unknown): CustomFieldDefinitionValidationResult {
  const errors: CustomFieldValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const key = typeof body.key === "string" ? body.key.trim().toLowerCase() : "";
  if (!KEY_RE.test(key)) {
    errors.push({ field: "key", message: "Key must be lowercase letters, numbers, and underscores, starting with a letter." });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) errors.push({ field: "label", message: "Label is required." });

  const fieldType = body.fieldType as CustomFieldType;
  if (!VALID_TYPES.includes(fieldType)) {
    errors.push({ field: "fieldType", message: `Field type must be one of: ${VALID_TYPES.join(", ")}.` });
  }

  const options = Array.isArray(body.options) ? body.options.filter((o): o is string => typeof o === "string") : undefined;
  if (OPTIONS_REQUIRED_TYPES.includes(fieldType) && (!options || options.length === 0)) {
    errors.push({ field: "options", message: `${fieldType} fields require at least one option.` });
  }

  const required = body.required === true;

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { key, label, fieldType, options, required } };
}

/**
 * Validates a Lead's custom-field values against their definitions —
 * called by leadService whenever customFields are written, so an
 * invalid value can never reach the database regardless of which route
 * wrote it (dedup update path, bulk update, or a direct edit).
 */
export function validateCustomFieldValues(
  values: Record<string, unknown>,
  definitions: CustomFieldDefinition[],
): CustomFieldValidationError[] {
  const errors: CustomFieldValidationError[] = [];
  const byKey = new Map(definitions.map((d) => [d.key, d]));

  for (const def of definitions) {
    const value = values[def.key];
    const isEmpty = value === undefined || value === null || value === "";
    if (def.required && isEmpty) {
      errors.push({ field: def.key, message: `${def.label} is required.` });
      continue;
    }
    if (isEmpty) continue;

    switch (def.fieldType) {
      case "number":
        if (typeof value !== "number" || Number.isNaN(value)) {
          errors.push({ field: def.key, message: `${def.label} must be a number.` });
        }
        break;
      case "date":
        if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
          errors.push({ field: def.key, message: `${def.label} must be a valid date.` });
        }
        break;
      case "checkbox":
        if (typeof value !== "boolean") {
          errors.push({ field: def.key, message: `${def.label} must be true or false.` });
        }
        break;
      case "dropdown":
      case "radio":
        if (typeof value !== "string" || !def.options?.includes(value)) {
          errors.push({ field: def.key, message: `${def.label} must be one of: ${def.options?.join(", ")}.` });
        }
        break;
      case "multiselect":
        if (!Array.isArray(value) || !value.every((v) => def.options?.includes(v))) {
          errors.push({ field: def.key, message: `${def.label} must be a subset of: ${def.options?.join(", ")}.` });
        }
        break;
      case "text":
        if (typeof value !== "string") {
          errors.push({ field: def.key, message: `${def.label} must be text.` });
        }
        break;
    }
  }

  for (const key of Object.keys(values)) {
    if (!byKey.has(key)) {
      errors.push({ field: key, message: `Unknown custom field "${key}".` });
    }
  }

  return errors;
}

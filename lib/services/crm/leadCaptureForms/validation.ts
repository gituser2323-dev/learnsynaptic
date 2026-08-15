import { defaultLeadCaptureFormFields, DEFAULT_LEAD_CAPTURE_SUCCESS_MESSAGE } from "./types";
import type { CreateLeadCaptureFormInput, LeadCaptureFormFieldConfig, LeadCaptureFormFields, UpdateLeadCaptureFormInput } from "./types";

export interface LeadCaptureFormValidationError {
  field: string;
  message: string;
}

export type CreateValidationResult =
  | { valid: true; data: CreateLeadCaptureFormInput }
  | { valid: false; errors: LeadCaptureFormValidationError[] };

export type UpdateValidationResult =
  | { valid: true; data: UpdateLeadCaptureFormInput }
  | { valid: false; errors: LeadCaptureFormValidationError[] };

function parseFieldConfig(raw: unknown, fallback: LeadCaptureFormFieldConfig): LeadCaptureFormFieldConfig {
  if (typeof raw !== "object" || raw === null) return fallback;
  const record = raw as Record<string, unknown>;
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : fallback.enabled,
    required: typeof record.required === "boolean" ? record.required : fallback.required,
  };
}

function parseFields(raw: unknown): LeadCaptureFormFields {
  const fallback = defaultLeadCaptureFormFields();
  if (typeof raw !== "object" || raw === null) return fallback;
  const record = raw as Record<string, unknown>;
  return {
    program: parseFieldConfig(record.program, fallback.program),
    message: parseFieldConfig(record.message, fallback.message),
  };
}

export function validateCreateLeadCaptureFormInput(input: unknown): CreateValidationResult {
  const errors: LeadCaptureFormValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.push({ field: "name", message: "Form name is required." });
  else if (name.length > 100) errors.push({ field: "name", message: "Form name must be 100 characters or fewer." });

  const successMessageRaw = typeof body.successMessage === "string" ? body.successMessage.trim() : "";
  if (successMessageRaw.length > 500) {
    errors.push({ field: "successMessage", message: "Success message must be 500 characters or fewer." });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      name,
      fields: parseFields(body.fields),
      successMessage: successMessageRaw || DEFAULT_LEAD_CAPTURE_SUCCESS_MESSAGE,
    },
  };
}

export function validateUpdateLeadCaptureFormInput(input: unknown): UpdateValidationResult {
  const errors: LeadCaptureFormValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const data: UpdateLeadCaptureFormInput = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) errors.push({ field: "name", message: "Form name is required." });
    else if (name.length > 100) errors.push({ field: "name", message: "Form name must be 100 characters or fewer." });
    else data.name = name;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") errors.push({ field: "active", message: "active must be true or false." });
    else data.active = body.active;
  }

  if (body.fields !== undefined) {
    data.fields = parseFields(body.fields);
  }

  if (body.successMessage !== undefined) {
    const successMessage = typeof body.successMessage === "string" ? body.successMessage.trim() : "";
    if (successMessage.length > 500) {
      errors.push({ field: "successMessage", message: "Success message must be 500 characters or fewer." });
    } else {
      data.successMessage = successMessage || DEFAULT_LEAD_CAPTURE_SUCCESS_MESSAGE;
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data };
}

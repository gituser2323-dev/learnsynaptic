import type { CreateLeadInput, LeadUtmParams, LeadValidationError } from "./types";

// Same rule already used in lib/ai-bootcamp/validation.ts and
// lib/ai-generalist/validation.ts — kept local rather than imported from
// there, since this module shouldn't depend on a program-specific one.
const INDIAN_MOBILE_RE = /^(?:\+91[\s-]?|91[\s-]?|0)?[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(value: string): string {
  const digits = value.trim().replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, "");
  return `+91${digits}`;
}

/** Lead Capture (tenant public forms) — pass-through only, same shape as
 *  parseUtm below. Never derived from client input directly: the only
 *  caller is publicSubmissionService, which constructs this from the
 *  LeadCaptureForm record it already resolved server-side, not from the
 *  anonymous request body. */
function parseCapturedVia(raw: unknown): { formId: string; formName: string } | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  if (typeof record.formId !== "string" || !record.formId) return undefined;
  return { formId: record.formId, formName: typeof record.formName === "string" ? record.formName : "" };
}

function parseUtm(raw: unknown): LeadUtmParams | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const utm: LeadUtmParams = {
    utmSource: typeof record.utmSource === "string" ? record.utmSource : undefined,
    utmMedium: typeof record.utmMedium === "string" ? record.utmMedium : undefined,
    utmCampaign: typeof record.utmCampaign === "string" ? record.utmCampaign : undefined,
    utmContent: typeof record.utmContent === "string" ? record.utmContent : undefined,
    utmTerm: typeof record.utmTerm === "string" ? record.utmTerm : undefined,
  };
  const hasAnyValue = Object.values(utm).some((v) => v !== undefined);
  return hasAnyValue ? utm : undefined;
}

export type ValidateCreateLeadInputResult =
  | { valid: true; data: CreateLeadInput }
  | { valid: false; errors: LeadValidationError[] };

/**
 * Validates and normalizes a raw, untrusted request body into
 * CreateLeadInput. This is the server-side validation boundary — never
 * trust the shape of a JSON.parse()'d request body, even if a client
 * form already validated it (a client can always be bypassed).
 */
export function validateCreateLeadInput(input: unknown): ValidateCreateLeadInputResult {
  const errors: LeadValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;

  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) errors.push({ field: "name", message: "Name is required." });
  else if (name.length > 100) errors.push({ field: "name", message: "Name must be under 100 characters." });

  const email = typeof record.email === "string" ? record.email.trim() : "";
  if (!email) errors.push({ field: "email", message: "Email is required." });
  else if (!EMAIL_RE.test(email)) errors.push({ field: "email", message: "Enter a valid email address." });

  const phoneRaw = typeof record.phone === "string" ? record.phone.trim() : "";
  if (!phoneRaw) errors.push({ field: "phone", message: "Phone number is required." });
  else if (!INDIAN_MOBILE_RE.test(phoneRaw.replace(/[\s-]/g, ""))) {
    errors.push({ field: "phone", message: "Enter a valid Indian mobile number." });
  }

  const source = typeof record.source === "string" ? record.source.trim() : "";
  if (!source) errors.push({ field: "source", message: "Source is required." });

  if (errors.length > 0) return { valid: false, errors };

  const program =
    typeof record.program === "string" && record.program.trim() ? record.program.trim() : undefined;
  const message =
    typeof record.message === "string" && record.message.trim() ? record.message.trim() : undefined;

  return {
    valid: true,
    data: {
      name,
      email,
      phone: normalizePhone(phoneRaw),
      program,
      source,
      message,
      utm: parseUtm(record.utm),
      capturedVia: parseCapturedVia(record.capturedVia),
    },
  };
}

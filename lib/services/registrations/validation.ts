import type { CreateRegistrationInput } from "@/lib/db";
import type { RegistrationValidationError } from "./types";

const SLUG_RE = /^[a-z0-9-]+$/;

export type ValidateCreateRegistrationInputResult =
  | { valid: true; data: CreateRegistrationInput }
  | { valid: false; errors: RegistrationValidationError[] };

/**
 * Field-level validation only — existence checks (does this leadId /
 * campaignId actually refer to a real record?) happen in
 * registrationService.createRegistration(), since they require a
 * repository lookup, not just shape validation.
 */
export function validateCreateRegistrationInput(input: unknown): ValidateCreateRegistrationInputResult {
  const errors: RegistrationValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;

  const leadId = typeof record.leadId === "string" ? record.leadId.trim() : "";
  if (!leadId) errors.push({ field: "leadId", message: "Lead id is required." });

  const programSlug = typeof record.programSlug === "string" ? record.programSlug.trim().toLowerCase() : "";
  if (!programSlug) errors.push({ field: "programSlug", message: "Program slug is required." });
  else if (!SLUG_RE.test(programSlug)) {
    errors.push({
      field: "programSlug",
      message: "Program slug must be lowercase letters, numbers, and hyphens only.",
    });
  }

  const source = typeof record.source === "string" ? record.source.trim() : "";
  if (!source) errors.push({ field: "source", message: "Source is required." });

  const campaignId =
    typeof record.campaignId === "string" && record.campaignId.trim() ? record.campaignId.trim() : undefined;

  if (errors.length > 0) return { valid: false, errors };

  const programName =
    typeof record.programName === "string" && record.programName.trim() ? record.programName.trim() : undefined;
  const cohortLabel =
    typeof record.cohortLabel === "string" && record.cohortLabel.trim() ? record.cohortLabel.trim() : undefined;

  return {
    valid: true,
    data: { leadId, programSlug, programName, cohortLabel, source, campaignId },
  };
}

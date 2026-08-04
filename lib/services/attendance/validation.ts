import type { CreateAttendanceInput } from "./types";
import type { AttendanceValidationError } from "./types";

export type ValidateCreateAttendanceInputResult =
  | { valid: true; data: CreateAttendanceInput }
  | { valid: false; errors: AttendanceValidationError[] };

export function validateCreateAttendanceInput(input: unknown): ValidateCreateAttendanceInputResult {
  const errors: AttendanceValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;

  const registrationId = typeof record.registrationId === "string" ? record.registrationId.trim() : "";
  if (!registrationId) errors.push({ field: "registrationId", message: "Registration id is required." });

  const sessionLabel = typeof record.sessionLabel === "string" ? record.sessionLabel.trim() : "";
  if (!sessionLabel) errors.push({ field: "sessionLabel", message: "Session label is required." });

  const sessionDateRaw = typeof record.sessionDate === "string" ? record.sessionDate : "";
  const sessionDate = sessionDateRaw ? new Date(sessionDateRaw) : null;
  if (!sessionDateRaw) errors.push({ field: "sessionDate", message: "Session date is required." });
  else if (!sessionDate || Number.isNaN(sessionDate.getTime())) {
    errors.push({ field: "sessionDate", message: "Session date must be a valid date." });
  }

  if (typeof record.present !== "boolean") {
    errors.push({ field: "present", message: "Present must be true or false." });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      registrationId,
      sessionLabel,
      sessionDate: (sessionDate as Date).toISOString(),
      present: record.present as boolean,
    },
  };
}

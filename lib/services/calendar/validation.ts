import { isCalendarProviderId } from "./registry";
import type { CalendarProviderId, MeetingInvitee } from "./types";

export interface MeetingValidationError {
  field: string;
  message: string;
}

export interface ValidatedScheduleMeetingInput {
  provider: CalendarProviderId;
  calendarId?: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  timezone: string;
  invitees: MeetingInvitee[];
  reminderMinutesBefore?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createFollowUpTask?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A conservative, real IANA timezone check (not exhaustive — Intl
// itself is the source of truth) rather than a hand-maintained list
// that inevitably drifts from the real tz database.
function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function validateScheduleMeetingInput(input: unknown): { valid: true; data: ValidatedScheduleMeetingInput } | { valid: false; errors: MeetingValidationError[] } {
  const errors: MeetingValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const provider = typeof body.provider === "string" && isCalendarProviderId(body.provider) ? body.provider : undefined;
  if (!provider) errors.push({ field: "provider", message: "provider must be a supported calendar provider id." });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) errors.push({ field: "title", message: "title is required." });

  const startAt = typeof body.startAt === "string" ? body.startAt : "";
  const startDate = startAt ? new Date(startAt) : null;
  if (!startAt || !startDate || Number.isNaN(startDate.getTime())) errors.push({ field: "startAt", message: "startAt must be a valid ISO date-time." });

  const endAt = typeof body.endAt === "string" ? body.endAt : "";
  const endDate = endAt ? new Date(endAt) : null;
  if (!endAt || !endDate || Number.isNaN(endDate.getTime())) errors.push({ field: "endAt", message: "endAt must be a valid ISO date-time." });

  if (startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate.getTime() <= startDate.getTime()) {
    errors.push({ field: "endAt", message: "endAt must be after startAt." });
  }

  const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "";
  if (!timezone || !isValidTimezone(timezone)) errors.push({ field: "timezone", message: "timezone must be a valid IANA timezone, e.g. \"Asia/Kolkata\"." });

  const inviteesRaw = Array.isArray(body.invitees) ? body.invitees : [];
  const invitees: MeetingInvitee[] = [];
  inviteesRaw.forEach((raw, index) => {
    const entry = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const email = typeof entry.email === "string" ? entry.email.trim() : "";
    if (!email || !EMAIL_RE.test(email)) {
      errors.push({ field: `invitees[${index}].email`, message: "Each invitee needs a valid email." });
      return;
    }
    invitees.push({ email, name: typeof entry.name === "string" ? entry.name : undefined });
  });

  const reminderMinutesBefore =
    typeof body.reminderMinutesBefore === "number" && body.reminderMinutesBefore >= 0 ? body.reminderMinutesBefore : undefined;

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      provider: provider!,
      calendarId: typeof body.calendarId === "string" && body.calendarId ? body.calendarId : undefined,
      title,
      description: typeof body.description === "string" ? body.description : undefined,
      startAt,
      endAt,
      timezone,
      invitees,
      reminderMinutesBefore,
      relatedEntityType: typeof body.relatedEntityType === "string" && body.relatedEntityType ? body.relatedEntityType : undefined,
      relatedEntityId: typeof body.relatedEntityId === "string" && body.relatedEntityId ? body.relatedEntityId : undefined,
      createFollowUpTask: body.createFollowUpTask === true,
    },
  };
}

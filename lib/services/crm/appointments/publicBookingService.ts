import { getAppointmentTypeRepository, getAppointmentRepository } from "@/lib/db";
import { DuplicateKeyError } from "@/lib/db/types";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { leadService } from "@/lib/services/leads";
import type { LeadValidationError } from "@/lib/services/leads";
import { activityService } from "@/lib/services/crm/activities";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { emailService } from "@/lib/services/email";
import { calendarService } from "@/lib/services/calendar";
import { findConnectedCalendarProviderId } from "@/lib/services/calendar/connectedProvider";
import { createLogger } from "@/lib/logger";
import { publish } from "@/lib/events";
import type { AppointmentType, WeeklyAvailabilitySlot } from "./types";

const logger = createLogger({ service: "appointments.publicBooking" });

export interface PublicAppointmentTypeConfig {
  name: string;
  description?: string;
  durationMinutes: number;
  timezone: string;
}

export type PublicBookingResult =
  | { success: true; name: string; startAt: string; endAt: string; timezone: string; duplicate: boolean }
  | { success: false; status: 404; message: string }
  | { success: false; status: 400; message: string; errors?: LeadValidationError[] }
  | { success: false; status: 409; message: string };

// ─── Timezone-aware slot math (no date library in this codebase — the
// same "Intl is the source of truth" posture lib/services/calendar/
// validation.ts already established, extended here to real conversion,
// not just validation) ──────────────────────────────────────────────────

/** The real UTC offset (minutes) `timezone` observes AT `instant` —
 *  derived from the actual instant, not a static table, so it's correct
 *  across a DST transition rather than only outside one. */
function getTimezoneOffsetMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asIfUtc - instant.getTime()) / 60_000;
}

/** Converts a calendar date (YYYY-MM-DD) + minutes-from-midnight, both
 *  meant as wall-clock time IN `timezone`, to a real UTC instant. Uses
 *  the standard two-pass technique (guess as if UTC, then correct by the
 *  real offset at that guess) — exact everywhere except within the few
 *  minutes of an actual DST transition, the same disclosed boundary
 *  every Intl-only timezone conversion in this codebase already accepts
 *  rather than pulling in a date library for. */
function zonedTimeToUtcIso(dateStr: string, minutesFromMidnight: number, timezone: string): string {
  const naiveUtc = new Date(`${dateStr}T00:00:00.000Z`);
  naiveUtc.setUTCMinutes(naiveUtc.getUTCMinutes() + minutesFromMidnight);
  const offsetMinutes = getTimezoneOffsetMinutes(naiveUtc, timezone);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000).toISOString();
}

/** The calendar date (YYYY-MM-DD) an ISO instant falls on, as seen from
 *  `timezone` — the inverse direction of zonedTimeToUtcIso, used to
 *  re-derive which day's slot list a submitted `startAt` belongs to. */
function isoInstantToDateInTimezone(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    new Date(iso),
  );
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}

/** The day-of-week (0=Sunday) a calendar date string represents — a
 *  property of the calendar date itself, not an instant, so this is
 *  deliberately timezone-independent (July 4 2026 is a Saturday
 *  regardless of which zone asks). */
function dayOfWeekForDateString(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
}

/** Every candidate slot start time (ISO instants) `weeklyAvailability`
 *  offers on `dateStr`, stepped by `durationMinutes`, before any
 *  existing-appointment or live-calendar exclusion — not yet
 *  availability, just the type's own raw offer for that one day. */
function candidateSlotsForDate(dateStr: string, durationMinutes: number, timezone: string, weeklyAvailability: WeeklyAvailabilitySlot[]): string[] {
  const dayOfWeek = dayOfWeekForDateString(dateStr);
  const slots: string[] = [];
  for (const window of weeklyAvailability) {
    if (window.dayOfWeek !== dayOfWeek) continue;
    for (let minute = window.startMinute; minute + durationMinutes <= window.endMinute; minute += durationMinutes) {
      slots.push(zonedTimeToUtcIso(dateStr, minute, timezone));
    }
  }
  return slots;
}

/**
 * The one real computation this module adds: `weeklyAvailability` for
 * the requested day → exclude anything overlapping an existing
 * non-cancelled Appointment for this counsellor (± bufferMinutes) →
 * exclude anything already in the past → exclude anything a connected
 * calendar provider's own real busy time covers, if one is connected
 * (see connectedProvider.ts's own doc comment — never called
 * speculatively when none is). Shared by both the public availability
 * endpoint and book()'s own server-side re-verification, so the two can
 * never drift out of sync with each other.
 */
async function computeAvailableSlots(appointmentType: AppointmentType, dateStr: string): Promise<string[]> {
  const candidates = candidateSlotsForDate(dateStr, appointmentType.durationMinutes, appointmentType.timezone, appointmentType.weeklyAvailability);
  if (candidates.length === 0) return [];

  const durationMs = appointmentType.durationMinutes * 60_000;
  const bufferMs = appointmentType.bufferMinutes * 60_000;
  const rangeStart = new Date(new Date(candidates[0]).getTime() - bufferMs).toISOString();
  const rangeEnd = new Date(new Date(candidates[candidates.length - 1]).getTime() + durationMs + bufferMs).toISOString();

  const appointmentRepository = await getAppointmentRepository();
  const existing = await appointmentRepository.findActiveForCounsellorInRange(appointmentType.assignedCounsellorId, rangeStart, rangeEnd);

  const occupied = existing.map((appointment) => ({
    start: new Date(appointment.startAt).getTime() - bufferMs,
    end: new Date(appointment.endAt).getTime() + bufferMs,
  }));

  let busy: { start: number; end: number }[] = [];
  const providerId = await findConnectedCalendarProviderId();
  if (providerId) {
    try {
      const calendars = await calendarService.listCalendars(providerId);
      const calendarId = calendars.find((c) => c.isPrimary)?.id ?? calendars[0]?.id;
      if (calendarId) {
        const intervals = await calendarService.getAvailability(providerId, calendarId, rangeStart, rangeEnd);
        busy = intervals.map((interval) => ({ start: new Date(interval.start).getTime(), end: new Date(interval.end).getTime() }));
      }
    } catch (error) {
      // Never forced — a connected-but-momentarily-failing provider just
      // means this day's slots aren't cross-checked against the live
      // calendar, not that booking is blocked entirely.
      logger.warn("appointments.live_availability_check_failed", { providerId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const now = Date.now();
  return candidates.filter((slotIso) => {
    const slotStart = new Date(slotIso).getTime();
    if (slotStart <= now) return false;
    const slotEnd = slotStart + durationMs;
    const overlapsOccupied = occupied.some((o) => slotStart < o.end && slotEnd > o.start);
    const overlapsBusy = busy.some((b) => slotStart < b.end && slotEnd > b.start);
    return !overlapsOccupied && !overlapsBusy;
  });
}

/**
 * The public, unauthenticated entry point into the existing CRM Lead
 * lifecycle for Appointment Booking — mirrors
 * publicSubmissionService.ts's own shape and reasoning exactly (see that
 * file's own module doc comment): everything below is either a
 * resolve-then-delegate step or a direct, unmodified call into an
 * existing service. leadService.registerLead() still owns validation,
 * dedup, scoring, auto-assignment, audit logging, and automation-trigger
 * publishing for the Lead itself; this module's only genuinely new job
 * is resolving an anonymous booking request to the correct organization
 * and computing/protecting a real appointment slot on top of it.
 */
export const publicBookingService = {
  /** `null` for an unknown OR inactive slug (deliberately
   *  indistinguishable — same reasoning as LeadCaptureForm's own
   *  getPublicFormConfig), so the page can render a real 404 either way. */
  async getPublicConfig(slug: string): Promise<PublicAppointmentTypeConfig | null> {
    const repository = await getAppointmentTypeRepository();
    const type = await repository.findByPublicSlug(slug);
    if (!type || !type.active) return null;
    return { name: type.name, description: type.description, durationMinutes: type.durationMinutes, timezone: type.timezone };
  },

  /** `null` has the identical unknown/inactive meaning as getPublicConfig
   *  above — the route maps both to the same 404. */
  async getAvailability(slug: string, dateStr: string): Promise<{ slots: string[] } | null> {
    const repository = await getAppointmentTypeRepository();
    const type = await repository.findByPublicSlug(slug);
    if (!type || !type.active || !type.organizationId) return null;

    return runWithTenantContext({ organizationId: type.organizationId }, async () => {
      const slots = await computeAvailableSlots(type, dateStr);
      return { slots };
    });
  },

  async book(slug: string, input: unknown): Promise<PublicBookingResult> {
    const repository = await getAppointmentTypeRepository();
    const type = await repository.findByPublicSlug(slug);

    // Hard reject, never a default-organization fallback — the exact
    // same reasoning publicSubmissionService.submit's own doc comment
    // gives: `slug` is a client-supplied, guessable public identifier
    // reachable by anonymous internet traffic, unlike an HMAC-signed
    // vendor webhook payload.
    if (!type || !type.active || !type.organizationId) {
      return { success: false, status: 404, message: "This booking page is not available." };
    }

    const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

    // Honeypot — identical shape to publicSubmissionService.submit's own:
    // a non-empty hidden field is treated as a successful booking from
    // the bot's own point of view, but never reaches leadService or the
    // appointment repository at all.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return { success: true, name: type.name, startAt: "", endAt: "", timezone: type.timezone, duplicate: false };
    }

    const startAt = typeof body.startAt === "string" ? body.startAt : "";
    const startDate = startAt ? new Date(startAt) : null;
    if (!startAt || !startDate || Number.isNaN(startDate.getTime())) {
      return { success: false, status: 400, message: "Please choose a valid time." };
    }

    const organizationId = type.organizationId;
    return runWithTenantContext({ organizationId }, async () => {
      // Never trust a stale client-side slot list — re-run the exact same
      // computation the availability endpoint uses, keyed off the
      // calendar date `startAt` falls on in the type's own timezone.
      const dateStr = isoInstantToDateInTimezone(startAt, type.timezone);
      const availableSlots = await computeAvailableSlots(type, dateStr);
      const stillAvailable = availableSlots.some((slot) => new Date(slot).getTime() === startDate.getTime());
      if (!stillAvailable) {
        return { success: false, status: 400, message: "That time is no longer available. Please choose another." };
      }

      const leadResult = await leadService.registerLead({
        name: body.name,
        email: body.email,
        phone: body.phone,
        source: "appointment_booking",
      });
      if (!leadResult.success) {
        return { success: false, status: 400, message: "Please check your details and try again.", errors: leadResult.errors };
      }
      const lead = leadResult.lead;

      const endAt = new Date(startDate.getTime() + type.durationMinutes * 60_000).toISOString();
      const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : undefined;

      const appointmentRepository = await getAppointmentRepository();
      let appointment;
      try {
        appointment = await appointmentRepository.create({
          leadId: lead.id,
          appointmentTypeId: type.id,
          assignedCounsellorId: type.assignedCounsellorId,
          startAt,
          endAt,
          timezone: type.timezone,
          source: "appointment_booking",
          notes,
        });
      } catch (error) {
        if (error instanceof DuplicateKeyError) {
          return { success: false, status: 409, message: "That time was just booked by someone else. Please choose another." };
        }
        throw error;
      }

      await activityService.logSystemEvent("Lead", lead.id, `Appointment booked: "${type.name}" at ${new Date(startAt).toLocaleString("en-IN", { timeZone: type.timezone })} (${type.timezone})`, organizationId);

      // Best-effort calendar sync — never forced, never faked. A
      // provider disconnected between the pre-check above and this call
      // is swallowed the same way calendarService.scheduleMeeting's own
      // "the row still persists on provider failure" posture already
      // handles a mid-call vendor failure, one layer up.
      const providerId = await findConnectedCalendarProviderId();
      if (providerId) {
        try {
          const meetingResult = await calendarService.scheduleMeeting({
            provider: providerId,
            title: type.name,
            description: notes,
            startAt,
            endAt,
            timezone: type.timezone,
            invitees: lead.email ? [{ email: lead.email, name: lead.name }] : [],
            relatedEntityType: "Lead",
            relatedEntityId: lead.id,
          });
          if (meetingResult.success) {
            appointment = await appointmentRepository.update(appointment.id, { meetingId: meetingResult.meeting.id });
          }
        } catch (error) {
          logger.warn("appointments.calendar_sync_failed", { providerId, error: error instanceof Error ? error.message : String(error) });
        }
      }

      // Guaranteed confirmation — a direct call, not automation-gated
      // (confirmed with the product owner), reusing Module 4.2's
      // emailService.sendEmail completely unchanged. Best-effort: a send
      // failure is logged, never blocks or fails the booking response —
      // the on-screen success page is the one guarantee that never
      // depends on email deliverability. `lead.email` is in practice
      // always present (leadService.registerLead's own validation
      // already requires it, the same requirement PublicLeadCaptureForm's
      // form has) — this guard is defensive, not a real phone-only path.
      if (lead.email) {
        try {
          await emailService.sendEmail(
            { email: lead.email, name: lead.name },
            {
              subject: "Your appointment is confirmed",
              bodyText: `Hi ${lead.name || "there"},\n\nYour appointment "${type.name}" is confirmed for ${new Date(startAt).toLocaleString("en-IN", { timeZone: type.timezone })} (${type.timezone}).\n\nSee you then!`,
            },
          );
        } catch (error) {
          logger.warn("appointments.confirmation_email_failed", { error: error instanceof Error ? error.message : String(error) });
        }
      }

      await publish("appointment.booked", {
        leadId: lead.id,
        appointmentId: appointment.id,
        appointmentTypeId: type.id,
        startAt,
        source: "appointment_booking",
      });

      await auditLogService.record({
        action: AUDIT_ACTIONS.APPOINTMENT_BOOKED,
        entityType: "Appointment",
        entityId: appointment.id,
        requestId: undefined,
        metadata: { appointmentTypeId: type.id, leadId: lead.id, startAt, duplicate: leadResult.duplicate },
      });

      return { success: true, name: type.name, startAt, endAt, timezone: type.timezone, duplicate: leadResult.duplicate };
    });
  },
};

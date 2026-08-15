import { getAppointmentRepository, getAppointmentTypeRepository } from "@/lib/db";
import { activityService } from "@/lib/services/crm/activities";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { publish } from "@/lib/events";
import type { PaginatedResult } from "@/lib/pagination";
import type { Appointment, AppointmentListFilters, AppointmentStatus } from "./types";

export type UpdateAppointmentStatusResult =
  | { success: true; appointment: Appointment }
  | { success: false; errors: { field: string; message: string }[] };

const STATUS_VERBS: Record<AppointmentStatus, string> = {
  scheduled: "booked",
  confirmed: "confirmed",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "marked as no-show",
};

// Every status this function can transition TO publishes the matching
// "appointment.<status>" event — all four already registered in
// automation/triggers.ts's SUPPORTED_TRIGGER_EVENT_TYPES. "scheduled" has
// no entry here: that transition only ever happens once, at booking time
// (publicBookingService.book publishes "appointment.booked" itself,
// since only that function has the fresh Lead/AppointmentType context a
// duplicate lookup here would otherwise re-fetch for no reason).
const STATUS_EVENTS: Partial<Record<AppointmentStatus, string>> = {
  confirmed: "appointment.confirmed",
  completed: "appointment.completed",
  cancelled: "appointment.cancelled",
  no_show: "appointment.no_show",
};

/**
 * Status transitions + admin/Lead-detail listing for Appointments. The
 * single place every lifecycle-transition publish + Lead Activity Timeline
 * entry happens — never scattered across multiple callers (the admin
 * PATCH route below is the only caller today, but a future automation
 * action or reschedule flow would call this same function, not duplicate
 * its body).
 */
export const appointmentService = {
  async getAppointment(id: string): Promise<Appointment | null> {
    const repository = await getAppointmentRepository();
    return repository.findById(id);
  },

  async listAppointments(filters: AppointmentListFilters, page = 1, limit = 20): Promise<PaginatedResult<Appointment>> {
    const repository = await getAppointmentRepository();
    return repository.list(filters, page, limit);
  },

  async updateStatus(id: string, status: AppointmentStatus, notes: string | undefined, context: AuditContext = {}): Promise<UpdateAppointmentStatusResult> {
    const repository = await getAppointmentRepository();
    const existing = await repository.findById(id);
    if (!existing) return { success: false, errors: [{ field: "id", message: "Appointment not found." }] };

    const statusChanged = existing.status !== status;
    const appointment = await repository.update(id, { status, notes });

    // A notes-only edit (status unchanged) skips the audit entry, Lead
    // Activity Timeline entry, and event publish below entirely — those
    // exist to record a real lifecycle TRANSITION, not to fire again
    // every time someone edits the notes field on an already-confirmed
    // appointment. The repository write above still applies regardless.
    if (!statusChanged) return { success: true, appointment };

    await auditLogService.record({
      action: AUDIT_ACTIONS.APPOINTMENT_STATUS_CHANGED,
      entityType: "Appointment",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { from: existing.status, to: status },
    });

    // CRM Integration: every meaningful appointment event reaches the
    // Lead's own timeline — the identical activityService.logSystemEvent
    // call shape calendarService.cancelMeeting already uses for Meetings.
    const typeRepository = await getAppointmentTypeRepository();
    const appointmentType = await typeRepository.findById(appointment.appointmentTypeId);
    const typeName = appointmentType?.name ?? "Appointment";
    await activityService.logSystemEvent("Lead", appointment.leadId, `Appointment ${STATUS_VERBS[status]}: "${typeName}"`, appointment.organizationId);

    const eventType = STATUS_EVENTS[status];
    if (eventType) {
      await publish(eventType, {
        leadId: appointment.leadId,
        appointmentId: appointment.id,
        appointmentTypeId: appointment.appointmentTypeId,
        startAt: appointment.startAt,
      });
    }

    return { success: true, appointment };
  },
};

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { appointmentService } from "@/lib/services/crm/appointments";
import type { AppointmentStatus } from "@/lib/services/crm/appointments";

const APPOINTMENT_STATUSES: AppointmentStatus[] = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

/**
 * PATCH /api/admin/crm/appointments/[id]
 *
 * Appointment Booking — Confirm/Complete/Cancel/Mark-no-show + notes
 * edit for one Appointment. The single HTTP entry point into
 * appointmentService.updateStatus, which is itself the single place
 * every lifecycle-transition publish + Lead Activity Timeline entry
 * happens (see that function's own doc comment) — never duplicated
 * per-caller. No separate DELETE: cancellation is a status transition
 * (status:"cancelled"), matching Meeting.cancelMeeting's own convention.
 *
 * ⚠️ requiredRole: "counsellor" — matches Meeting's own counsellor-tier
 * cancel/update convention (app/api/admin/meetings/[id]/route.ts) — a
 * counsellor should be able to mark their own appointment
 * completed/no-show without needing a manager.
 */
async function handleUpdateAppointment(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = await parseJsonBody<Record<string, unknown>>(request);

  const errors: { field: string; message: string }[] = [];
  let status: AppointmentStatus | undefined;
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !APPOINTMENT_STATUSES.includes(body.status as AppointmentStatus)) {
      errors.push({ field: "status", message: `status must be one of: ${APPOINTMENT_STATUSES.join(", ")}.` });
    } else {
      status = body.status as AppointmentStatus;
    }
  }

  let notes: string | undefined;
  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") {
      errors.push({ field: "notes", message: "notes must be a string." });
    } else {
      notes = body.notes.trim().slice(0, 2000);
    }
  }

  if (!status && notes === undefined) {
    errors.push({ field: "root", message: "Provide status and/or notes to update." });
  }
  if (errors.length > 0) throw new ValidationApiError(errors);

  const existing = await appointmentService.getAppointment(id);
  if (!existing) throw new NotFoundApiError("Appointment", id);

  const result = await appointmentService.updateStatus(id, status ?? existing.status, notes, { requestId: ctx.requestId, actorId: ctx.authContext.userId });
  if (!result.success) throw new NotFoundApiError("Appointment", id);
  return apiSuccess({ appointment: result.appointment });
}

export const PATCH = withApiRoute("admin.crm.appointments.update", handleUpdateAppointment, {
  requiredRole: "counsellor",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

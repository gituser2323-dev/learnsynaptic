import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams } from "@/lib/api";
import { appointmentService } from "@/lib/services/crm/appointments";
import type { AppointmentStatus } from "@/lib/services/crm/appointments";

const APPOINTMENT_STATUSES: AppointmentStatus[] = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

/**
 * GET /api/admin/crm/appointments
 *
 * Appointment Booking — the one generic list endpoint both the admin
 * "Bookings" tab (app/admin/(dashboard)/appointments/page.tsx) and the
 * Lead Detail page's own LeadAppointmentsSection call (with `leadId`
 * set), mirroring GET /api/admin/meetings's own shape exactly (Module
 * 6.3) — no bespoke per-caller route.
 *
 * ⚠️ requiredRole: "counsellor" — same floor tier Meetings/Leads/
 * Activities already use.
 */
async function handleListAppointments(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const status = searchParams.get("status");
  const result = await appointmentService.listAppointments(
    {
      leadId: searchParams.get("leadId") || undefined,
      appointmentTypeId: searchParams.get("appointmentTypeId") || undefined,
      status: status && APPOINTMENT_STATUSES.includes(status as AppointmentStatus) ? (status as AppointmentStatus) : undefined,
    },
    page,
    limit,
  );
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.crm.appointments.list", handleListAppointments, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

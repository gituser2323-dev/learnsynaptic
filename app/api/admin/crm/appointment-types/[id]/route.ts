import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { appointmentTypeService } from "@/lib/services/crm/appointments";

/**
 * GET /api/admin/crm/appointment-types/[id], PATCH /api/admin/crm/appointment-types/[id],
 * DELETE /api/admin/crm/appointment-types/[id]
 *
 * Appointment Booking — generic edit (name/description/duration/buffer/
 * timezone/weeklyAvailability/assignedCounsellorId/active) and delete for
 * one type. Mirrors app/api/admin/crm/lead-capture-forms/[id]/route.ts's
 * own generic-edit shape. Deleting a type does NOT touch any Appointment
 * already booked through it — same "stale reference just stops
 * resolving" posture Tag/LeadCaptureForm deletion already established.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, GET stays
 * "counsellor" (same split as the sibling route above).
 */
async function handleGetAppointmentType(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const appointmentType = await appointmentTypeService.getAppointmentType(id);
  if (!appointmentType) throw new NotFoundApiError("AppointmentType", id);
  return apiSuccess({ appointmentType });
}

async function handleUpdateAppointmentType(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const existing = await appointmentTypeService.getAppointmentType(id);
  if (!existing) throw new NotFoundApiError("AppointmentType", id);

  const body = await parseJsonBody(request);
  const result = await appointmentTypeService.updateAppointmentType(id, body, { requestId: ctx.requestId, actorId: ctx.authContext.userId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ appointmentType: result.appointmentType });
}

async function handleDeleteAppointmentType(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  await appointmentTypeService.deleteAppointmentType(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  return apiSuccess({ deleted: true });
}

export const GET = withApiRoute("admin.crm.appointmentTypes.get", handleGetAppointmentType, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const PATCH = withApiRoute("admin.crm.appointmentTypes.update", handleUpdateAppointmentType, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

export const DELETE = withApiRoute("admin.crm.appointmentTypes.delete", handleDeleteAppointmentType, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

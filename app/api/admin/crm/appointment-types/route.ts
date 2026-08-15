import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { appointmentTypeService } from "@/lib/services/crm/appointments";

/**
 * GET /api/admin/crm/appointment-types, POST /api/admin/crm/appointment-types
 *
 * Appointment Booking — admin CRUD for the tenant-facing bookable
 * appointment types (the "PUBLIC BOOKING LINK" entry point). Mirrors
 * app/api/admin/crm/lead-capture-forms/route.ts's own route shape
 * exactly.
 *
 * ⚠️ RBAC: GET is "counsellor" — read-only, needed to see which types
 * exist; POST (creating a new public booking type) is "manager" — CRM
 * configuration, the same tier tag/custom-field/lead-capture-form
 * creation already uses.
 */
async function handleListAppointmentTypes(): Promise<NextResponse> {
  const appointmentTypes = await appointmentTypeService.listAppointmentTypes();
  return apiSuccess({ appointmentTypes });
}

async function handleCreateAppointmentType(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  const result = await appointmentTypeService.createAppointmentType(body, { requestId: ctx.requestId, actorId: ctx.authContext.userId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ appointmentType: result.appointmentType }, 201);
}

export const GET = withApiRoute("admin.crm.appointmentTypes.list", handleListAppointmentTypes, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.crm.appointmentTypes.create", handleCreateAppointmentType, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

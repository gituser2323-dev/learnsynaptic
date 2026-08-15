import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { publicBookingService } from "@/lib/services/crm/appointments";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/booking/[slug]/availability?date=YYYY-MM-DD
 *
 * Appointment Booking — the public, unauthenticated "which times are
 * still open on this one day" lookup the booking page's own Date step
 * calls before rendering Time-step buttons. A sibling route under the
 * same [slug] segment, the same nesting shape already established by
 * app/api/admin/integrations/[providerId]/calendars and
 * .../calendar-sync (Module 6.3).
 */
async function handleGetAvailability(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { slug } = ctx.params;
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!DATE_RE.test(date)) {
    throw new ValidationApiError([{ field: "date", message: "date must be in YYYY-MM-DD format." }]);
  }

  const result = await publicBookingService.getAvailability(slug, date);
  if (!result) throw new NotFoundApiError("AppointmentType", slug);
  return apiSuccess(result);
}

export const GET = withApiRoute("booking.getAvailability", handleGetAvailability, {
  rateLimit: { limit: 60, windowMs: 60_000 },
});

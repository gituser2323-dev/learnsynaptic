import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, ValidationApiError, UpstreamServiceApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { calendarService, isCalendarProviderId, CalendarProviderNotConnectedError, CalendarProviderError } from "@/lib/services/calendar";

/**
 * GET /api/admin/integrations/[providerId]/availability?calendarId=&start=&end=
 *
 * Calendar & Meeting Connectors (Phase 6), Module 6.3 — "Availability
 * Lookup": real busy intervals for the connected calendar over a
 * range, so a counsellor can see free time before scheduling.
 *
 * ⚠️ requiredRole: "counsellor" — same floor as /calendars.
 */
async function handleGetAvailability(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  if (!isCalendarProviderId(providerId)) throw new NotFoundApiError("Integration", providerId);

  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get("calendarId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!calendarId || !start || !end) {
    throw new ValidationApiError([{ field: "root", message: "calendarId, start, and end query params are required." }]);
  }

  try {
    const busy = await calendarService.getAvailability(providerId, calendarId, start, end);
    return apiSuccess({ busy });
  } catch (error) {
    if (error instanceof CalendarProviderNotConnectedError) throw new NotFoundApiError("Integration", providerId);
    if (error instanceof CalendarProviderError) throw new UpstreamServiceApiError(error.message);
    throw error;
  }
}

export const GET = withApiRoute("admin.integrations.calendar.availability", handleGetAvailability, {
  requiredRole: "counsellor",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

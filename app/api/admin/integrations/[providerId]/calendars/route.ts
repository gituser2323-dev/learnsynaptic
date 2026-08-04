import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, UpstreamServiceApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { calendarService, isCalendarProviderId, CalendarProviderNotConnectedError, CalendarProviderError } from "@/lib/services/calendar";

/**
 * GET /api/admin/integrations/[providerId]/calendars
 *
 * Calendar & Meeting Connectors (Phase 6), Module 6.3 — "Calendar
 * Selection": lists the connected account's real calendars, so an
 * admin/counsellor can pick which one a meeting should be created on.
 *
 * ⚠️ requiredRole: "counsellor" — a counsellor scheduling a meeting
 * needs to see the calendar list too, the same floor as the meetings
 * route itself; the provider CONNECTION is still admin-managed.
 */
async function handleListCalendars(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  if (!isCalendarProviderId(providerId)) throw new NotFoundApiError("Integration", providerId);

  try {
    const calendars = await calendarService.listCalendars(providerId);
    return apiSuccess({ calendars });
  } catch (error) {
    if (error instanceof CalendarProviderNotConnectedError) throw new NotFoundApiError("Integration", providerId);
    if (error instanceof CalendarProviderError) throw new UpstreamServiceApiError(error.message);
    throw error;
  }
}

export const GET = withApiRoute("admin.integrations.calendar.calendars", handleListCalendars, {
  requiredRole: "counsellor",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

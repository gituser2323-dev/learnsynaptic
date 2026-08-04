import { NextResponse } from "next/server";
import { withApiRoute, NotFoundApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { calendarService, isCalendarProviderId, CalendarProviderNotConfiguredError } from "@/lib/services/calendar";

/**
 * GET /api/admin/integrations/[providerId]/oauth/authorize
 *
 * Calendar & Meeting Connectors (Phase 6), Module 6.3 — the first real
 * OAuth-callback-adjacent route in this codebase (see the pre-build
 * research: no prior precedent existed). Redirects the admin's browser
 * to the real vendor consent screen; the `state` param embedded in
 * that URL is what oauth/callback verifies on the way back (CSRF
 * protection — see oauthState.ts).
 *
 * ⚠️ requiredRole: "admin" — same tier as connect/disconnect/config on
 * every other Integrations Registry provider (Module 6.1); this is
 * establishing an org-wide provider connection, not scheduling a
 * meeting.
 */
async function handleAuthorize(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  if (!isCalendarProviderId(providerId)) throw new NotFoundApiError("Integration", providerId);

  try {
    const url = calendarService.getAuthorizationUrl(providerId);
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof CalendarProviderNotConfiguredError) {
      throw new ValidationApiError([{ field: "providerId", message: error.message }]);
    }
    throw error;
  }
}

export const GET = withApiRoute("admin.integrations.calendar.oauthAuthorize", handleAuthorize, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

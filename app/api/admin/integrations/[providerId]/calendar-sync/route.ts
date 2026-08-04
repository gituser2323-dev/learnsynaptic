import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, UpstreamServiceApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { calendarService, isCalendarProviderId, CalendarProviderNotConnectedError, CalendarProviderError } from "@/lib/services/calendar";
import { integrationService } from "@/lib/services/integrations";

/**
 * POST /api/admin/integrations/[providerId]/calendar-sync
 *
 * Calendar & Meeting Connectors (Phase 6), Module 6.3 — "Sync Now": a
 * real, cheap, read-only vendor call (list calendars) that confirms
 * the connection is still live and refreshes its health/lastSuccessAt/
 * lastFailureAt via the Integrations Registry's own recordSync — no
 * second health-check mechanism built.
 *
 * ⚠️ requiredRole: "admin" — a provider-connection-management action,
 * the same tier as connect/disconnect/config (Module 6.1).
 */
async function handleSyncNow(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  if (!isCalendarProviderId(providerId)) throw new NotFoundApiError("Integration", providerId);

  try {
    await calendarService.syncNow(providerId);
    const integration = await integrationService.getIntegration(providerId);
    return apiSuccess({ integration });
  } catch (error) {
    if (error instanceof CalendarProviderNotConnectedError) throw new NotFoundApiError("Integration", providerId);
    if (error instanceof CalendarProviderError) throw new UpstreamServiceApiError(error.message);
    throw error;
  }
}

export const POST = withApiRoute("admin.integrations.calendar.syncNow", handleSyncNow, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

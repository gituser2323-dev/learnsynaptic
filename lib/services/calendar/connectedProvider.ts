import { integrationService } from "@/lib/services/integrations";
import { CALENDAR_PROVIDER_IDS } from "./registry";
import type { CalendarProviderId } from "./types";

/**
 * Appointment Booking (the Growth-track module after Lead Capture) needs
 * to know "is ANY calendar provider connected for this org right now,
 * and which one" before it can safely call calendarService.getAvailability/
 * scheduleMeeting — those hard-throw CalendarProviderNotConnectedError
 * with no fallback (see calendarService.ts's own assertProviderReady).
 * This is the one small piece of new glue that didn't already exist:
 * everything it calls (integrationService.getIntegration,
 * CALENDAR_PROVIDER_IDS) is unchanged and reused directly, not
 * re-derived.
 */

/** Returns the first calendar provider connected+enabled for the active
 *  tenant, or `undefined` if none — never throws. Callers must treat
 *  `undefined` as "no calendar sync available right now," not an error:
 *  Appointment Booking works entirely from its own stored availability
 *  when no provider is connected (see publicBookingService.ts). */
export async function findConnectedCalendarProviderId(): Promise<CalendarProviderId | undefined> {
  for (const providerId of CALENDAR_PROVIDER_IDS) {
    const integration = await integrationService.getIntegration(providerId);
    if (integration?.status === "connected" && integration.enabled) return providerId;
  }
  return undefined;
}

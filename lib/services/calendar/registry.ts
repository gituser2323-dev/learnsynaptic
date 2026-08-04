import { createGoogleCalendarProvider } from "./providers/googleCalendar.provider";
import { createMicrosoftGraphProvider } from "./providers/microsoftGraph.provider";
import { zoomProvider } from "./providers/zoom.provider";
import type { CalendarProvider, CalendarProviderId } from "./types";

/**
 * Calendar & Meeting Connectors (Module 6.3) — the one place allowed
 * to import a concrete provider adapter, mirroring
 * lib/services/storage/registry.ts exactly. calendarService.ts never
 * imports a provider module directly.
 */
const CALENDAR_PROVIDERS: Record<CalendarProviderId, CalendarProvider> = {
  google_calendar: createGoogleCalendarProvider("google_calendar"),
  google_meet: createGoogleCalendarProvider("google_meet"),
  microsoft_outlook_calendar: createMicrosoftGraphProvider("microsoft_outlook_calendar"),
  microsoft_teams_meetings: createMicrosoftGraphProvider("microsoft_teams_meetings"),
  zoom: zoomProvider,
};

export const CALENDAR_PROVIDER_IDS: CalendarProviderId[] = Object.keys(CALENDAR_PROVIDERS) as CalendarProviderId[];

export function isCalendarProviderId(value: string): value is CalendarProviderId {
  return (CALENDAR_PROVIDER_IDS as string[]).includes(value);
}

export function getCalendarProvider(id: CalendarProviderId): CalendarProvider {
  return CALENDAR_PROVIDERS[id];
}

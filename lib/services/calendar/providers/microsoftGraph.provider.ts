import { MICROSOFT_OAUTH_CONFIG } from "@/config/calendar";
import { CALENDAR_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { CalendarProviderError, CalendarProviderNotConfiguredError } from "../errors";
import type {
  BusyInterval,
  CalendarListEntry,
  CalendarProvider,
  CalendarProviderId,
  CreateMeetingInput,
  OAuthTokenSet,
  ProviderMeetingResult,
  UpdateMeetingInput,
} from "../types";

/**
 * Calendar & Meeting Connectors (Module 6.3) — Microsoft Outlook
 * Calendar / Microsoft Teams (Meetings). One real adapter backs both
 * catalog ids, the same "one OAuth app, one API, a flag that changes
 * on create" shape as googleCalendar.provider.ts: Teams meeting links
 * are created through the *same* Microsoft Graph calendar-event API by
 * setting `isOnlineMeeting: true` + `onlineMeetingProvider:
 * "teamsForBusiness"` — there's no separate "Teams API" a plain
 * calendar event connector needs. `createMicrosoftGraphProvider(
 * "microsoft_teams_meetings")` differs from the
 * `"microsoft_outlook_calendar"` variant only in setting that flag.
 *
 * Plain `fetch` against Microsoft Graph's documented v1.0 REST
 * endpoints, no `@microsoft/microsoft-graph-client` SDK dependency —
 * same "hand-rolled fetch unless the crypto itself is genuinely
 * complex" convention googleCalendar.provider.ts's own doc comment
 * already explains for this module.
 */

const API_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = ["offline_access", "Calendars.ReadWrite", "OnlineMeetings.ReadWrite"];

function tokenEndpoint(): string {
  return `https://login.microsoftonline.com/${MICROSOFT_OAUTH_CONFIG.tenantId}/oauth2/v2.0/token`;
}
function authEndpoint(): string {
  return `https://login.microsoftonline.com/${MICROSOFT_OAUTH_CONFIG.tenantId}/oauth2/v2.0/authorize`;
}

function assertConfigured(id: CalendarProviderId): void {
  const missing: string[] = [];
  if (!MICROSOFT_OAUTH_CONFIG.clientId) missing.push("MICROSOFT_OAUTH_CLIENT_ID");
  if (!MICROSOFT_OAUTH_CONFIG.clientSecret) missing.push("MICROSOFT_OAUTH_CLIENT_SECRET");
  if (!MICROSOFT_OAUTH_CONFIG.redirectUri) missing.push("MICROSOFT_OAUTH_REDIRECT_URI");
  if (missing.length > 0) throw new CalendarProviderNotConfiguredError(id, `missing env vars: ${missing.join(", ")}`);
}

interface MsTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function requestTokens(id: CalendarProviderId, body: URLSearchParams): Promise<OAuthTokenSet> {
  const response = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
  });
  const data = (await response.json()) as MsTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new CalendarProviderError(id, data.error_description || data.error || `token request failed (${response.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scope: data.scope,
  };
}

function toGraphEventBody(input: CreateMeetingInput | UpdateMeetingInput, isTeamsMeeting: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.subject = input.title;
  if (input.description !== undefined) body.body = { contentType: "text", content: input.description };
  if (input.startAt !== undefined && input.timezone !== undefined) body.start = { dateTime: input.startAt, timeZone: input.timezone };
  if (input.endAt !== undefined && input.timezone !== undefined) body.end = { dateTime: input.endAt, timeZone: input.timezone };
  if (input.invitees !== undefined) {
    body.attendees = input.invitees.map((i) => ({ emailAddress: { address: i.email, name: i.name }, type: "required" }));
  }
  if (input.reminderMinutesBefore !== undefined) {
    body.isReminderOn = true;
    body.reminderMinutesBeforeStart = input.reminderMinutesBefore;
  }
  if (isTeamsMeeting) {
    body.isOnlineMeeting = true;
    body.onlineMeetingProvider = "teamsForBusiness";
  }
  return body;
}

interface GraphEventResponse {
  id: string;
  onlineMeeting?: { joinUrl?: string };
  error?: { message?: string };
}

export function createMicrosoftGraphProvider(
  id: Extract<CalendarProviderId, "microsoft_outlook_calendar" | "microsoft_teams_meetings">,
): CalendarProvider {
  const isTeamsMeeting = id === "microsoft_teams_meetings";

  return {
    id,

    getAuthorizationUrl(state: string): string {
      assertConfigured(id);
      const params = new URLSearchParams({
        client_id: MICROSOFT_OAUTH_CONFIG.clientId,
        response_type: "code",
        redirect_uri: MICROSOFT_OAUTH_CONFIG.redirectUri,
        scope: SCOPES.join(" "),
        response_mode: "query",
        state,
      });
      return `${authEndpoint()}?${params.toString()}`;
    },

    async exchangeCodeForTokens(code: string): Promise<OAuthTokenSet> {
      assertConfigured(id);
      return requestTokens(
        id,
        new URLSearchParams({
          code,
          client_id: MICROSOFT_OAUTH_CONFIG.clientId,
          client_secret: MICROSOFT_OAUTH_CONFIG.clientSecret,
          redirect_uri: MICROSOFT_OAUTH_CONFIG.redirectUri,
          grant_type: "authorization_code",
          scope: SCOPES.join(" "),
        }),
      );
    },

    async refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
      assertConfigured(id);
      const refreshed = await requestTokens(
        id,
        new URLSearchParams({
          refresh_token: refreshToken,
          client_id: MICROSOFT_OAUTH_CONFIG.clientId,
          client_secret: MICROSOFT_OAUTH_CONFIG.clientSecret,
          grant_type: "refresh_token",
          scope: SCOPES.join(" "),
        }),
      );
      return { ...refreshed, refreshToken: refreshed.refreshToken || refreshToken };
    },

    async listCalendars(tokens: OAuthTokenSet): Promise<CalendarListEntry[]> {
      const response = await fetch(`${API_BASE}/me/calendars`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
      });
      const data = (await response.json()) as { value?: { id: string; name: string; isDefaultCalendar?: boolean }[]; error?: { message?: string } };
      if (!response.ok) throw new CalendarProviderError(id, data.error?.message || `listCalendars failed (${response.status})`);
      return (data.value || []).map((c) => ({ id: c.id, name: c.name, isPrimary: !!c.isDefaultCalendar }));
    },

    /** Microsoft Graph's `getSchedule` is mailbox-based, not calendar-id
     *  based — `calendarId` here is expected to be the mailbox/user
     *  email address to check, the same identifier `listCalendars`
     *  doesn't directly expose but the connected account's own sign-in
     *  email (available from the OAuth id token / `/me`) naturally is.
     *  Documented here rather than silently assumed, since it's a real
     *  API-shape difference from Google's calendar-id-based freeBusy. */
    async getAvailability(tokens: OAuthTokenSet, calendarId: string, rangeStart: string, rangeEnd: string): Promise<BusyInterval[]> {
      const response = await fetch(`${API_BASE}/me/calendar/getSchedule`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json", Prefer: 'outlook.timezone="UTC"' },
        body: JSON.stringify({
          schedules: [calendarId],
          startTime: { dateTime: rangeStart, timeZone: "UTC" },
          endTime: { dateTime: rangeEnd, timeZone: "UTC" },
        }),
        signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
      });
      const data = (await response.json()) as {
        value?: { scheduleItems?: { start: { dateTime: string }; end: { dateTime: string } }[] }[];
        error?: { message?: string };
      };
      if (!response.ok) throw new CalendarProviderError(id, data.error?.message || `getAvailability failed (${response.status})`);
      const items = data.value?.[0]?.scheduleItems || [];
      return items.map((item) => ({ start: item.start.dateTime, end: item.end.dateTime }));
    },

    async createEvent(tokens: OAuthTokenSet, input: CreateMeetingInput): Promise<ProviderMeetingResult> {
      const calendarPath = input.calendarId ? `/me/calendars/${encodeURIComponent(input.calendarId)}/events` : "/me/events";
      const response = await fetch(`${API_BASE}${calendarPath}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(toGraphEventBody(input, isTeamsMeeting)),
        signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
      });
      const data = (await response.json()) as GraphEventResponse;
      if (!response.ok) throw new CalendarProviderError(id, data.error?.message || `createEvent failed (${response.status})`);
      return { externalEventId: data.id, meetingLink: data.onlineMeeting?.joinUrl };
    },

    async updateEvent(tokens: OAuthTokenSet, externalEventId: string, _calendarId: string | undefined, input: UpdateMeetingInput): Promise<ProviderMeetingResult> {
      const response = await fetch(`${API_BASE}/me/events/${encodeURIComponent(externalEventId)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(toGraphEventBody(input, false)),
        signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
      });
      const data = (await response.json()) as GraphEventResponse;
      if (!response.ok) throw new CalendarProviderError(id, data.error?.message || `updateEvent failed (${response.status})`);
      return { externalEventId: data.id, meetingLink: data.onlineMeeting?.joinUrl };
    },

    async cancelEvent(tokens: OAuthTokenSet, externalEventId: string): Promise<void> {
      const response = await fetch(`${API_BASE}/me/events/${encodeURIComponent(externalEventId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
      });
      // Graph returns 204 on success and 404 for an already-deleted event — both a successful "it's gone" outcome.
      if (!response.ok && response.status !== 404) {
        throw new CalendarProviderError(id, `cancelEvent failed (${response.status})`);
      }
    },
  };
}

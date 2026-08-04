import { randomUUID } from "crypto";
import { GOOGLE_OAUTH_CONFIG } from "@/config/calendar";
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
 * Calendar & Meeting Connectors (Module 6.3) — Google Calendar / Google
 * Meet. One real adapter backs both catalog ids: Google Meet has no
 * separate scheduling API of its own — a Meet link is created by
 * asking the Calendar API's `events.insert` for one
 * (`conferenceData.createRequest`), the exact mechanism Google's own
 * documentation describes. `createGoogleCalendarProvider("google_meet")`
 * differs from the `"google_calendar"` variant only in always
 * requesting that conference link; every other method is identical,
 * since they share one OAuth app/connection and one REST API.
 *
 * Plain `fetch` against Google's documented REST endpoints, no
 * `googleapis` SDK dependency — deliberately, matching this codebase's
 * established "hand-rolled fetch unless the crypto itself is genuinely
 * complex" convention (see awsS3.provider.ts's own doc comment on why
 * *that* one deviates): OAuth2's authorization-code grant and a
 * handful of stable, simple JSON REST calls don't carry SigV4-level
 * signing risk.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const API_BASE = "https://www.googleapis.com/calendar/v3";
const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.readonly"];

function assertConfigured(id: CalendarProviderId): void {
  const missing: string[] = [];
  if (!GOOGLE_OAUTH_CONFIG.clientId) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!GOOGLE_OAUTH_CONFIG.clientSecret) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!GOOGLE_OAUTH_CONFIG.redirectUri) missing.push("GOOGLE_OAUTH_REDIRECT_URI");
  if (missing.length > 0) throw new CalendarProviderNotConfiguredError(id, `missing env vars: ${missing.join(", ")}`);
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function requestTokens(id: CalendarProviderId, body: URLSearchParams): Promise<OAuthTokenSet> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
  });
  const data = (await response.json()) as GoogleTokenResponse;
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

function toGoogleEventBody(input: CreateMeetingInput | UpdateMeetingInput, includeMeetLink: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.summary = input.title;
  if (input.description !== undefined) body.description = input.description;
  if (input.startAt !== undefined && input.timezone !== undefined) body.start = { dateTime: input.startAt, timeZone: input.timezone };
  if (input.endAt !== undefined && input.timezone !== undefined) body.end = { dateTime: input.endAt, timeZone: input.timezone };
  if (input.invitees !== undefined) body.attendees = input.invitees.map((i) => ({ email: i.email, displayName: i.name }));
  if (input.reminderMinutesBefore !== undefined) {
    body.reminders = { useDefault: false, overrides: [{ method: "popup", minutes: input.reminderMinutesBefore }] };
  }
  if (includeMeetLink) {
    body.conferenceData = { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
  }
  return body;
}

interface GoogleEventResponse {
  id: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
  error?: { message?: string };
}

function extractMeetingLink(event: GoogleEventResponse): string | undefined {
  if (event.hangoutLink) return event.hangoutLink;
  const videoEntry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  return videoEntry?.uri;
}

export function createGoogleCalendarProvider(id: Extract<CalendarProviderId, "google_calendar" | "google_meet">): CalendarProvider {
  const includeMeetLink = id === "google_meet";

  return {
    id,

    getAuthorizationUrl(state: string): string {
      assertConfigured(id);
      const params = new URLSearchParams({
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline", // Required to receive a refresh_token at all.
        prompt: "consent", // Forces a refresh_token on every connect, not just the first ever grant.
        state,
      });
      return `${AUTH_ENDPOINT}?${params.toString()}`;
    },

    async exchangeCodeForTokens(code: string): Promise<OAuthTokenSet> {
      assertConfigured(id);
      return requestTokens(
        id,
        new URLSearchParams({
          code,
          client_id: GOOGLE_OAUTH_CONFIG.clientId,
          client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
          redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
          grant_type: "authorization_code",
        }),
      );
    },

    async refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
      assertConfigured(id);
      const refreshed = await requestTokens(
        id,
        new URLSearchParams({
          refresh_token: refreshToken,
          client_id: GOOGLE_OAUTH_CONFIG.clientId,
          client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
          grant_type: "refresh_token",
        }),
      );
      // Google's refresh grant doesn't always return a new refresh_token — keep the existing one when it doesn't.
      return { ...refreshed, refreshToken: refreshed.refreshToken || refreshToken };
    },

    async listCalendars(tokens: OAuthTokenSet): Promise<CalendarListEntry[]> {
      const response = await fetch(`${API_BASE}/users/me/calendarList`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
      });
      const data = (await response.json()) as { items?: { id: string; summary: string; primary?: boolean }[]; error?: { message?: string } };
      if (!response.ok) throw new CalendarProviderError(id, data.error?.message || `listCalendars failed (${response.status})`);
      return (data.items || []).map((c) => ({ id: c.id, name: c.summary, isPrimary: !!c.primary }));
    },

    async getAvailability(tokens: OAuthTokenSet, calendarId: string, rangeStart: string, rangeEnd: string): Promise<BusyInterval[]> {
      const response = await fetch(`${API_BASE}/freeBusy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ timeMin: rangeStart, timeMax: rangeEnd, items: [{ id: calendarId }] }),
        signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
      });
      const data = (await response.json()) as {
        calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
        error?: { message?: string };
      };
      if (!response.ok) throw new CalendarProviderError(id, data.error?.message || `getAvailability failed (${response.status})`);
      return data.calendars?.[calendarId]?.busy || [];
    },

    async createEvent(tokens: OAuthTokenSet, input: CreateMeetingInput): Promise<ProviderMeetingResult> {
      const calendarId = input.calendarId || "primary";
      const response = await fetch(`${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(toGoogleEventBody(input, includeMeetLink)),
        signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
      });
      const data = (await response.json()) as GoogleEventResponse;
      if (!response.ok) throw new CalendarProviderError(id, data.error?.message || `createEvent failed (${response.status})`);
      return { externalEventId: data.id, meetingLink: extractMeetingLink(data) };
    },

    async updateEvent(tokens: OAuthTokenSet, externalEventId: string, calendarId: string | undefined, input: UpdateMeetingInput): Promise<ProviderMeetingResult> {
      const resolvedCalendarId = calendarId || "primary";
      const response = await fetch(
        `${API_BASE}/calendars/${encodeURIComponent(resolvedCalendarId)}/events/${encodeURIComponent(externalEventId)}?conferenceDataVersion=1`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(toGoogleEventBody(input, false)),
          signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
        },
      );
      const data = (await response.json()) as GoogleEventResponse;
      if (!response.ok) throw new CalendarProviderError(id, data.error?.message || `updateEvent failed (${response.status})`);
      return { externalEventId: data.id, meetingLink: extractMeetingLink(data) };
    },

    async cancelEvent(tokens: OAuthTokenSet, externalEventId: string, calendarId?: string): Promise<void> {
      const resolvedCalendarId = calendarId || "primary";
      const response = await fetch(
        `${API_BASE}/calendars/${encodeURIComponent(resolvedCalendarId)}/events/${encodeURIComponent(externalEventId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${tokens.accessToken}` }, signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS) },
      );
      // Google returns 204 with no body on success, and 410 Gone for an
      // already-deleted event — both are a successful "it's gone" outcome.
      if (!response.ok && response.status !== 410) {
        throw new CalendarProviderError(id, `cancelEvent failed (${response.status})`);
      }
    },
  };
}

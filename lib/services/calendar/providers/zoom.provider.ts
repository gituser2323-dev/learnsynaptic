import { ZOOM_OAUTH_CONFIG } from "@/config/calendar";
import { CALENDAR_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { CalendarProviderError, CalendarProviderNotConfiguredError } from "../errors";
import type {
  BusyInterval,
  CalendarListEntry,
  CalendarProvider,
  CreateMeetingInput,
  OAuthTokenSet,
  ProviderMeetingResult,
  UpdateMeetingInput,
} from "../types";

/**
 * Calendar & Meeting Connectors (Module 6.3) — Zoom. Zoom is a video-
 * meeting product, not a calendar product: it has no "calendars"
 * concept and no native free/busy API the way Google/Microsoft do.
 * Two deliberate, disclosed adaptations rather than silently faking a
 * calendar-shaped API Zoom doesn't have:
 *   - `listCalendars()` returns one synthetic entry ("My Zoom
 *     Meetings") — there is nothing else to select between.
 *   - `getAvailability()` is real, not fabricated, but derived: it
 *     lists the connected account's own scheduled meetings
 *     (GET /users/me/meetings) and reports each one's real start/end
 *     as a busy interval. This is Zoom's actual own-meetings data, not
 *     a guess — just not a true calendar free/busy computation the
 *     way Google/Microsoft's dedicated endpoints provide.
 *
 * Token endpoint uses HTTP Basic Auth (base64 client_id:client_secret)
 * per Zoom's own documented OAuth app flow — the one real difference
 * from Google/Microsoft's body-embedded client credentials.
 */

const TOKEN_ENDPOINT = "https://zoom.us/oauth/token";
const AUTH_ENDPOINT = "https://zoom.us/oauth/authorize";
const API_BASE = "https://api.zoom.us/v2";

function assertConfigured(): void {
  const missing: string[] = [];
  if (!ZOOM_OAUTH_CONFIG.clientId) missing.push("ZOOM_OAUTH_CLIENT_ID");
  if (!ZOOM_OAUTH_CONFIG.clientSecret) missing.push("ZOOM_OAUTH_CLIENT_SECRET");
  if (!ZOOM_OAUTH_CONFIG.redirectUri) missing.push("ZOOM_OAUTH_REDIRECT_URI");
  if (missing.length > 0) throw new CalendarProviderNotConfiguredError("zoom", `missing env vars: ${missing.join(", ")}`);
}

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${ZOOM_OAUTH_CONFIG.clientId}:${ZOOM_OAUTH_CONFIG.clientSecret}`).toString("base64")}`;
}

interface ZoomTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  error?: string;
  reason?: string;
}

async function requestTokens(body: URLSearchParams): Promise<OAuthTokenSet> {
  const response = await fetch(`${TOKEN_ENDPOINT}?${body.toString()}`, {
    method: "POST",
    headers: { Authorization: basicAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
  });
  const data = (await response.json()) as ZoomTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new CalendarProviderError("zoom", data.reason || data.error || `token request failed (${response.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scope: data.scope,
  };
}

interface ZoomMeetingResponse {
  id: number;
  join_url?: string;
  message?: string;
}

export const zoomProvider: CalendarProvider = {
  id: "zoom",

  getAuthorizationUrl(state: string): string {
    assertConfigured();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: ZOOM_OAUTH_CONFIG.clientId,
      redirect_uri: ZOOM_OAUTH_CONFIG.redirectUri,
      state,
    });
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  },

  async exchangeCodeForTokens(code: string): Promise<OAuthTokenSet> {
    assertConfigured();
    return requestTokens(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: ZOOM_OAUTH_CONFIG.redirectUri }));
  },

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
    assertConfigured();
    const refreshed = await requestTokens(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
    return { ...refreshed, refreshToken: refreshed.refreshToken || refreshToken };
  },

  async listCalendars(): Promise<CalendarListEntry[]> {
    return [{ id: "me", name: "My Zoom Meetings", isPrimary: true }];
  },

  async getAvailability(tokens: OAuthTokenSet, _calendarId: string, rangeStart: string, rangeEnd: string): Promise<BusyInterval[]> {
    const response = await fetch(`${API_BASE}/users/me/meetings?type=scheduled&page_size=300`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
    });
    const data = (await response.json()) as { meetings?: { start_time?: string; duration?: number }[]; message?: string };
    if (!response.ok) throw new CalendarProviderError("zoom", data.message || `getAvailability failed (${response.status})`);

    const rangeStartMs = new Date(rangeStart).getTime();
    const rangeEndMs = new Date(rangeEnd).getTime();
    const busy: BusyInterval[] = [];
    for (const meeting of data.meetings || []) {
      if (!meeting.start_time) continue;
      const startMs = new Date(meeting.start_time).getTime();
      const endMs = startMs + (meeting.duration || 0) * 60_000;
      if (endMs < rangeStartMs || startMs > rangeEndMs) continue;
      busy.push({ start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() });
    }
    return busy;
  },

  async createEvent(tokens: OAuthTokenSet, input: CreateMeetingInput): Promise<ProviderMeetingResult> {
    const durationMinutes = Math.max(1, Math.round((new Date(input.endAt).getTime() - new Date(input.startAt).getTime()) / 60_000));
    const response = await fetch(`${API_BASE}/users/me/meetings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: input.title,
        agenda: input.description,
        type: 2, // Scheduled meeting.
        start_time: input.startAt,
        duration: durationMinutes,
        timezone: input.timezone,
        settings: { join_before_host: true },
      }),
      signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
    });
    const data = (await response.json()) as ZoomMeetingResponse;
    if (!response.ok) throw new CalendarProviderError("zoom", data.message || `createEvent failed (${response.status})`);
    return { externalEventId: String(data.id), meetingLink: data.join_url };
  },

  async updateEvent(tokens: OAuthTokenSet, externalEventId: string, _calendarId: string | undefined, input: UpdateMeetingInput): Promise<ProviderMeetingResult> {
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.topic = input.title;
    if (input.description !== undefined) body.agenda = input.description;
    if (input.startAt !== undefined) body.start_time = input.startAt;
    if (input.timezone !== undefined) body.timezone = input.timezone;
    if (input.startAt !== undefined && input.endAt !== undefined) {
      body.duration = Math.max(1, Math.round((new Date(input.endAt).getTime() - new Date(input.startAt).getTime()) / 60_000));
    }

    const response = await fetch(`${API_BASE}/meetings/${encodeURIComponent(externalEventId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
    });
    // Zoom's PATCH returns 204 No Content on success — re-fetch to report the (unchanged) join_url and confirm the id.
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as ZoomMeetingResponse;
      throw new CalendarProviderError("zoom", data.message || `updateEvent failed (${response.status})`);
    }
    return { externalEventId, meetingLink: undefined };
  },

  async cancelEvent(tokens: OAuthTokenSet, externalEventId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/meetings/${encodeURIComponent(externalEventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      signal: AbortSignal.timeout(CALENDAR_PROVIDER_TIMEOUT_MS),
    });
    // Zoom returns 204 on success and 404 for an already-deleted meeting — both a successful "it's gone" outcome.
    if (!response.ok && response.status !== 404) {
      throw new CalendarProviderError("zoom", `cancelEvent failed (${response.status})`);
    }
  },
};

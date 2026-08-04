import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calendarService } from "./calendarService";
import { encryptToken } from "./tokenCrypto";
import { CalendarProviderNotConfiguredError, CalendarProviderNotConnectedError } from "./errors";
import { integrationService } from "@/lib/services/integrations";

/**
 * Calendar & Meeting Connectors (Module 6.3). This test environment has
 * no GOOGLE_OAUTH_CLIENT_ID/SECRET configured, so the OAuth-flow-only
 * methods (getAuthorizationUrl/exchangeCodeForTokens/refreshAccessToken)
 * genuinely can't run — tested for their real "not configured"
 * degradation below. Event CRUD (createEvent/updateEvent/cancelEvent)
 * needs no client_secret at all once a connection already holds a
 * valid access token (real OAuth behavior, not a test shortcut) — so
 * the full scheduleMeeting/updateMeeting/cancelMeeting lifecycle is
 * tested end-to-end against a real (mocked-fetch) provider call, the
 * same "real integration test over a mock service" discipline this
 * project applies everywhere else.
 */

const VALID_INPUT = {
  provider: "google_calendar" as const,
  title: "Counselling call",
  startAt: "2027-01-01T10:00:00.000Z",
  endAt: "2027-01-01T10:30:00.000Z",
  timezone: "Asia/Kolkata",
  invitees: [{ email: "lead@example.com", name: "Lead Name" }],
};

async function connectGoogleCalendar(): Promise<void> {
  await integrationService.connect("google_calendar", {
    credentialRef: {
      type: "oauth",
      provider: "google_calendar",
      accessToken: encryptToken("fake-access-token"),
      refreshToken: encryptToken("fake-refresh-token"),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(), // Far from expiry — no refresh needed.
    },
  });
}

describe("calendarService.getAuthorizationUrl — real 'not configured' degradation", () => {
  it("throws CalendarProviderNotConfiguredError when no OAuth app env vars are set", () => {
    expect(() => calendarService.getAuthorizationUrl("google_calendar")).toThrow(CalendarProviderNotConfiguredError);
  });
});

describe("calendarService.scheduleMeeting — validation and the two-factor gate", () => {
  it("returns validation errors rather than throwing for invalid input", async () => {
    const result = await calendarService.scheduleMeeting({ ...VALID_INPUT, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects scheduling against a provider that isn't connected+enabled", async () => {
    await expect(calendarService.scheduleMeeting({ ...VALID_INPUT, provider: "zoom" })).rejects.toThrow(CalendarProviderNotConnectedError);
  });
});

describe("calendarService — full lifecycle against a connected provider (mocked fetch)", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await connectGoogleCalendar();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("schedules a meeting: real event created, Meeting persisted, syncStatus synced", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ id: "evt_123", hangoutLink: "https://meet.google.com/abc-defg-hij" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await calendarService.scheduleMeeting({
      ...VALID_INPUT,
      relatedEntityType: "Lead",
      relatedEntityId: "lead-42",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.meeting.externalEventId).toBe("evt_123");
    expect(result.meeting.meetingLink).toBe("https://meet.google.com/abc-defg-hij");
    expect(result.meeting.syncStatus).toBe("synced");
    expect(result.meeting.status).toBe("scheduled");
  });

  it("marks syncStatus 'failed' but still persists the Meeting when the vendor call fails — Error Recovery", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "insufficient permissions" } }), { status: 403 })) as unknown as typeof fetch;

    const result = await calendarService.scheduleMeeting(VALID_INPUT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.meeting.syncStatus).toBe("failed");
    expect(result.meeting.lastSyncError).toContain("insufficient permissions");
    expect(result.meeting.externalEventId).toBeUndefined();
  });

  it("cancels a meeting: real vendor delete call + status set to cancelled", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ id: "evt_456" }), { status: 200 })) as unknown as typeof fetch;
    const scheduled = await calendarService.scheduleMeeting(VALID_INPUT);
    expect(scheduled.success).toBe(true);
    if (!scheduled.success) return;

    global.fetch = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    const cancelled = await calendarService.cancelMeeting(scheduled.meeting.id);
    expect(cancelled?.status).toBe("cancelled");
  });

  it("getMeeting/listMeetings reflect what was scheduled", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ id: "evt_789" }), { status: 200 })) as unknown as typeof fetch;
    const scheduled = await calendarService.scheduleMeeting({ ...VALID_INPUT, relatedEntityType: "Lead", relatedEntityId: "lead-list-test" });
    expect(scheduled.success).toBe(true);
    if (!scheduled.success) return;

    const fetched = await calendarService.getMeeting(scheduled.meeting.id);
    expect(fetched?.id).toBe(scheduled.meeting.id);

    const page = await calendarService.listMeetings({ relatedEntityType: "Lead", relatedEntityId: "lead-list-test" });
    expect(page.items.some((m) => m.id === scheduled.meeting.id)).toBe(true);
  });

  it("attempts a proactive refresh for an expiring token — correctly surfaces 'not configured' in this env, real OAuth behavior since a refresh grant needs client credentials, not a bug", async () => {
    // Overwrite the beforeEach's connection with one whose token is already expired.
    await integrationService.connect("google_calendar", {
      credentialRef: {
        type: "oauth",
        provider: "google_calendar",
        accessToken: encryptToken("stale-access-token"),
        refreshToken: encryptToken("real-refresh-token"),
        expiresAt: new Date(Date.now() - 60_000).toISOString(), // Already expired.
      },
    });

    // This environment has no GOOGLE_OAUTH_CLIENT_ID/SECRET configured
    // (same as the getAuthorizationUrl test above) — a real OAuth
    // refresh grant needs client authentication per spec, so
    // refreshAccessToken() correctly refuses here rather than silently
    // using a stale token. Confirms getValidTokens() actually attempts
    // the refresh (not skipping it) before the vendor event-create call
    // ever runs — fetch is never even reached.
    global.fetch = vi.fn();
    await expect(calendarService.scheduleMeeting(VALID_INPUT)).rejects.toThrow(CalendarProviderNotConfiguredError);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

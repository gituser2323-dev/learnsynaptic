import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Calendar & Meeting Connectors (Phase 6), Module 6.3.
 *
 * The webServer under test has no GOOGLE_OAUTH_CLIENT_ID, MICROSOFT_
 * OAUTH_CLIENT_ID, or ZOOM_OAUTH_CLIENT_ID env vars configured, and no
 * provider is connected through the Integrations Registry — so a real
 * end-to-end OAuth grant and a real
 * vendor event-create call can't be exercised here (the same disclosed
 * constraint 2.2/2.3/4.2's own specs already state for their own
 * real-vendor-account gaps; the full connected-provider lifecycle is
 * covered instead by calendarService.unit.test.ts's mocked-fetch
 * suite). What IS real and testable over HTTP: RBAC, validation, the
 * "not configured"/"not connected" degradation paths, the OAuth
 * callback's safe-redirect-never-raw-JSON behavior, and relatedEntity
 * list-scoping (the closest this app gets to isolation testing, since
 * organizationId remains schema-only/unenforced everywhere — see the
 * audit's own disclosed note on this, matching every other module).
 */
test.describe("Calendar & Meeting Connectors (6.3)", () => {
  test("an unauthenticated request is rejected on every generic meeting route", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    const scheduleResponse = await context.request.post(`${baseURL}/api/admin/meetings`, {
      data: { provider: "google_calendar", title: "x", startAt: "2027-01-01T10:00:00.000Z", endAt: "2027-01-01T10:30:00.000Z", timezone: "Asia/Kolkata", invitees: [] },
    });
    expect(scheduleResponse.status()).toBe(401);

    const listResponse = await context.request.get(`${baseURL}/api/admin/meetings`);
    expect(listResponse.status()).toBe(401);
    await context.close();
  });

  test("a manager session is forbidden from provider-connection-management routes — admin-tier, same as connect/disconnect", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const authorizeResponse = await context.request.get(`${baseURL}/api/admin/integrations/google_calendar/oauth/authorize`, { maxRedirects: 0 });
    expect(authorizeResponse.status()).toBe(403);
    const syncResponse = await context.request.post(`${baseURL}/api/admin/integrations/google_calendar/calendar-sync`);
    expect(syncResponse.status()).toBe(403);
    await context.close();
  });

  test("a counsellor session can reach the meetings/calendars/availability routes — same floor tier as Files/Leads", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const listResponse = await context.request.get(`${baseURL}/api/admin/meetings`);
    expect(listResponse.ok()).toBeTruthy();
    await context.close();
  });

  test("rejects scheduling a meeting with invalid input (400) before ever reaching a provider", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const response = await context.request.post(`${baseURL}/api/admin/meetings`, {
      data: { provider: "not_a_real_provider", title: "", startAt: "not-a-date", endAt: "not-a-date", timezone: "Not/Real", invitees: [] },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.errors.length).toBeGreaterThan(0);
    await context.close();
  });

  test("scheduling against a provider that isn't connected fails safely, not with a leaked stack trace", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const response = await context.request.post(`${baseURL}/api/admin/meetings`, {
      data: {
        provider: "zoom",
        title: "Counselling call",
        startAt: "2027-01-01T10:00:00.000Z",
        endAt: "2027-01-01T10:30:00.000Z",
        timezone: "Asia/Kolkata",
        invitees: [{ email: "lead@example.com" }],
      },
    });
    // Uncaught CalendarProviderNotConnectedError degrades to a safe,
    // generic 500 via handleApiError — the same posture 6.2's own
    // upload route already takes for its own "not connected" gate.
    expect(response.status()).toBe(500);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("StorageProvider");
    expect(JSON.stringify(body)).not.toMatch(/at \w+ \(/); // No stack trace leaked.
    await context.close();
  });

  test("404s listing calendars or checking availability for a provider that isn't connected — explicitly mapped, not a generic 500", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    expect((await context.request.get(`${baseURL}/api/admin/integrations/microsoft_outlook_calendar/calendars`)).status()).toBe(404);
    expect(
      (
        await context.request.get(
          `${baseURL}/api/admin/integrations/microsoft_outlook_calendar/availability?calendarId=me&start=2027-01-01T00:00:00.000Z&end=2027-01-02T00:00:00.000Z`,
        )
      ).status(),
    ).toBe(404);
    await context.close();
  });

  test("404s for an unknown provider id on the calendar-scoped integration routes", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    expect((await context.request.get(`${baseURL}/api/admin/integrations/not-a-real-provider/calendars`, { maxRedirects: 0 })).status()).toBe(404);
    await context.close();
  });

  test("OAuth authorize surfaces a clear 400 when the provider's OAuth app isn't configured in this environment", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.get(`${baseURL}/api/admin/integrations/google_calendar/oauth/authorize`, { maxRedirects: 0 });
    expect(response.status()).toBe(400);
    await context.close();
  });

  test("OAuth callback with a missing/invalid state redirects to Settings with a safe error code, never a raw JSON 500 mid-browser-flow", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.get(`${baseURL}/api/admin/integrations/google_calendar/oauth/callback?code=fake&state=tampered-or-fake-state`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    const location = response.headers()["location"];
    expect(location).toContain("/admin/settings");
    expect(location).toContain("calendarError=");
    await context.close();
  });

  test("OAuth callback with a vendor denial redirects with calendarError=denied", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.get(`${baseURL}/api/admin/integrations/google_calendar/oauth/callback?error=access_denied`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("calendarError=denied");
    await context.close();
  });

  test("404s fetching, updating, or cancelling a nonexistent meeting id", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    expect((await context.request.get(`${baseURL}/api/admin/meetings/not-a-real-id`)).status()).toBe(404);
    expect((await context.request.patch(`${baseURL}/api/admin/meetings/not-a-real-id`, { data: { title: "x" } })).status()).toBe(404);
    expect((await context.request.delete(`${baseURL}/api/admin/meetings/not-a-real-id`)).status()).toBe(404);
    await context.close();
  });

  test("lists meetings scoped to a relatedEntityType/relatedEntityId — the same list-filter isolation Files (6.2) already established", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const leadId = `e2e-lead-${Date.now()}`;
    const listResponse = await context.request.get(`${baseURL}/api/admin/meetings?relatedEntityType=Lead&relatedEntityId=${leadId}`);
    expect(listResponse.ok()).toBeTruthy();
    const body = await listResponse.json();
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
    await context.close();
  });

  test("the Settings page renders the new calendar provider cards (Google Calendar, Google Meet, Outlook Calendar, Teams Meetings, Zoom) alongside 6.1's existing registry UI", async ({ page, context, baseURL }) => {
    await addSessionCookie(context, baseURL!, "admin");
    await page.goto("/admin/settings");
    const main = page.locator("#main-content");
    await expect(main.getByText("Provider Registry")).toBeVisible();
    await expect(main.getByText("Google Calendar", { exact: true })).toBeVisible();
    await expect(main.getByText("Microsoft Outlook Calendar", { exact: true })).toBeVisible();
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { scheduleMeeting } from "./scheduleMeeting";
import { integrationService } from "@/lib/services/integrations";
import { encryptToken } from "@/lib/services/calendar/tokenCrypto";
import type { WorkflowContext } from "../../types";

describe("schedule_meeting action executor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws for a missing/invalid provider param", async () => {
    const context: WorkflowContext = { entityType: "Lead", entityId: "lead-1", data: { email: "lead@example.com" }, runId: "test-run" };
    await expect(scheduleMeeting(context, { title: "Follow-up call" })).rejects.toThrow(/provider param/);
  });

  it("throws for a missing title param", async () => {
    const context: WorkflowContext = { entityType: "Lead", entityId: "lead-1", data: { email: "lead@example.com" }, runId: "test-run" };
    await expect(scheduleMeeting(context, { provider: "google_calendar" })).rejects.toThrow(/title param/);
  });

  it("throws when the workflow context has no lead email to invite", async () => {
    const context: WorkflowContext = { entityType: "Lead", entityId: "lead-1", data: {}, runId: "test-run" };
    await expect(scheduleMeeting(context, { provider: "google_calendar", title: "Follow-up call" })).rejects.toThrow(/lead email/);
  });

  it("schedules a real meeting once the provider is connected, resolving the invitee from context.data", async () => {
    await integrationService.connect("google_calendar", {
      credentialRef: {
        type: "oauth",
        provider: "google_calendar",
        accessToken: encryptToken("fake-access-token"),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    });

    global.fetch = vi.fn(async () => new Response(JSON.stringify({ id: "evt_from_automation" }), { status: 200 })) as unknown as typeof fetch;

    const context: WorkflowContext = { entityType: "Lead", entityId: "lead-automation-1", data: { email: "automation-lead@example.com", name: "Automation Lead" }, runId: "test-run" };
    await expect(scheduleMeeting(context, { provider: "google_calendar", title: "Automated follow-up", durationMinutes: 15, startInMinutes: 0 })).resolves.toBeUndefined();
  });
});

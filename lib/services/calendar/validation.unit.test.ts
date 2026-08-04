import { describe, it, expect } from "vitest";
import { validateScheduleMeetingInput } from "./validation";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    provider: "google_calendar",
    title: "Counselling call",
    startAt: "2027-01-01T10:00:00.000Z",
    endAt: "2027-01-01T10:30:00.000Z",
    timezone: "Asia/Kolkata",
    invitees: [{ email: "lead@example.com", name: "Lead Name" }],
    ...overrides,
  };
}

describe("validateScheduleMeetingInput", () => {
  it("accepts a well-formed input", () => {
    const result = validateScheduleMeetingInput(validInput());
    expect(result.valid).toBe(true);
  });

  it("rejects an unsupported provider id", () => {
    const result = validateScheduleMeetingInput(validInput({ provider: "not_a_real_provider" }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.field === "provider")).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = validateScheduleMeetingInput(validInput({ title: "" }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.field === "title")).toBe(true);
  });

  it("rejects an invalid startAt", () => {
    const result = validateScheduleMeetingInput(validInput({ startAt: "not-a-date" }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.field === "startAt")).toBe(true);
  });

  it("rejects endAt before startAt", () => {
    const result = validateScheduleMeetingInput(validInput({ startAt: "2027-01-01T10:00:00.000Z", endAt: "2027-01-01T09:00:00.000Z" }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.field === "endAt")).toBe(true);
  });

  it("rejects an invalid IANA timezone", () => {
    const result = validateScheduleMeetingInput(validInput({ timezone: "Not/A_Real_Zone" }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.field === "timezone")).toBe(true);
  });

  it("rejects an invitee with a malformed email", () => {
    const result = validateScheduleMeetingInput(validInput({ invitees: [{ email: "not-an-email" }] }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.field === "invitees[0].email")).toBe(true);
  });

  it("accepts zero invitees (a solo/internal meeting)", () => {
    const result = validateScheduleMeetingInput(validInput({ invitees: [] }));
    expect(result.valid).toBe(true);
  });

  it("passes through optional fields correctly", () => {
    const result = validateScheduleMeetingInput(
      validInput({ calendarId: "primary", description: "Discuss the GenAI Builder cohort", reminderMinutesBefore: 15, relatedEntityType: "Lead", relatedEntityId: "lead-1", createFollowUpTask: true }),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.calendarId).toBe("primary");
      expect(result.data.reminderMinutesBefore).toBe(15);
      expect(result.data.relatedEntityType).toBe("Lead");
      expect(result.data.createFollowUpTask).toBe(true);
    }
  });
});

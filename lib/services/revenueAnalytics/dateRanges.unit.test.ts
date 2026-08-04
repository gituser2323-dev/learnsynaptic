import { describe, it, expect } from "vitest";
import { resolveDateRangeFromParams } from "./dateRanges";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Date Filtering (mission
 * §10). Every boundary is anchored to a fixed, known instant (not
 * Date.now()) so these assertions never depend on when the test suite
 * happens to run.
 */
describe("resolveDateRangeFromParams — IST-anchored day/month boundaries", () => {
  // 2026-08-02T04:46:32.010Z == 2026-08-02T10:16:32.010+05:30 (mid-morning IST, no midnight ambiguity).
  const NOW_MS = Date.parse("2026-08-02T04:46:32.010Z");

  it("defaults to last30 when neither preset nor from/to is supplied", () => {
    const range = resolveDateRangeFromParams(new URLSearchParams(), NOW_MS);
    expect(range.preset).toBe("last30");
  });

  it("today: exactly the IST calendar day containing NOW_MS", () => {
    const range = resolveDateRangeFromParams(new URLSearchParams("preset=today"), NOW_MS);
    expect(range.from).toBe("2026-08-01T18:30:00.000Z"); // 2026-08-02T00:00:00.000+05:30
    expect(range.to).toBe("2026-08-02T18:29:59.999Z"); // 2026-08-02T23:59:59.999+05:30
  });

  it("yesterday: the IST calendar day before today", () => {
    const range = resolveDateRangeFromParams(new URLSearchParams("preset=yesterday"), NOW_MS);
    expect(range.from).toBe("2026-07-31T18:30:00.000Z");
    expect(range.to).toBe("2026-08-01T18:29:59.999Z");
  });

  it("last7: 7 IST calendar days inclusive, ending today", () => {
    const range = resolveDateRangeFromParams(new URLSearchParams("preset=last7"), NOW_MS);
    expect(range.from).toBe("2026-07-26T18:30:00.000Z"); // 2026-07-27 00:00 IST
    expect(range.to).toBe("2026-08-02T18:29:59.999Z");
  });

  it("thisMonth: IST month-start through today, not through month-end", () => {
    const range = resolveDateRangeFromParams(new URLSearchParams("preset=thisMonth"), NOW_MS);
    expect(range.from).toBe("2026-07-31T18:30:00.000Z"); // 2026-08-01 00:00 IST
    expect(range.to).toBe("2026-08-02T18:29:59.999Z"); // today, not 2026-08-31
  });

  it("prevMonth: the full previous IST calendar month", () => {
    const range = resolveDateRangeFromParams(new URLSearchParams("preset=prevMonth"), NOW_MS);
    expect(range.from).toBe("2026-06-30T18:30:00.000Z"); // 2026-07-01 00:00 IST
    expect(range.to).toBe("2026-07-31T18:29:59.999Z"); // 2026-07-31 23:59:59.999 IST
  });

  it("prevMonth correctly crosses a year boundary (January -> December)", () => {
    const januaryMs = Date.parse("2026-01-15T04:46:32.010Z"); // 2026-01-15 IST
    const range = resolveDateRangeFromParams(new URLSearchParams("preset=prevMonth"), januaryMs);
    expect(range.from).toBe("2025-11-30T18:30:00.000Z"); // 2025-12-01 00:00 IST
    expect(range.to).toBe("2025-12-31T18:29:59.999Z");
  });

  it("custom range: from/to both normalized to IST day start/end", () => {
    const range = resolveDateRangeFromParams(new URLSearchParams("from=2026-07-10&to=2026-07-12"), NOW_MS);
    expect(range.preset).toBe("custom");
    expect(range.from).toBe("2026-07-09T18:30:00.000Z");
    expect(range.to).toBe("2026-07-12T18:29:59.999Z");
  });

  it("custom range takes precedence over a preset param when both are present", () => {
    const range = resolveDateRangeFromParams(new URLSearchParams("preset=today&from=2026-07-10&to=2026-07-12"), NOW_MS);
    expect(range.preset).toBe("custom");
  });

  it("an invalid preset value falls back to last30, not a thrown error", () => {
    const range = resolveDateRangeFromParams(new URLSearchParams("preset=nonsense"), NOW_MS);
    expect(range.preset).toBe("last30");
  });

  it("a real IST-midnight-crossing instant still resolves 'today' to the correct IST day", () => {
    // 2026-07-31T18:35:00.000Z == 2026-08-01T00:05:00.000+05:30 — 5 minutes into a new IST day.
    const nearMidnightMs = Date.parse("2026-07-31T18:35:00.000Z");
    const range = resolveDateRangeFromParams(new URLSearchParams("preset=today"), nearMidnightMs);
    expect(range.from).toBe("2026-07-31T18:30:00.000Z"); // 2026-08-01 00:00 IST, not 2026-07-31
  });
});

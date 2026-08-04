import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Date Filtering (mission
 * §10). Every boundary is computed against India Standard Time
 * (Asia/Kolkata, UTC+5:30) — this business's own real operating
 * timezone, the same one lib/cohortDate.ts already anchors cohort
 * scheduling to, rather than the server process's own UTC clock. "Today"
 * for an admin in Bengaluru genuinely is a different 24-hour window than
 * server-UTC "today" for roughly 5.5 hours of every day; silently using
 * UTC would make the "Today" preset show the wrong day's data during
 * that window.
 *
 * DateRange.from/to are always full ISO instants — from at 00:00:00.000
 * IST of the first day, to at 23:59:59.999 IST of the last day — NOT
 * the date-only strings lib/services/marketing's own /api/admin/marketing
 * route uses. That route's date-only convention silently excludes
 * almost all of its own `to` day once compared against a full
 * createdAt timestamp (`new Date("2026-07-31") <=` only matches exact
 * midnight); this module's own repositories (Payment/WorkflowRun/
 * Message/Task/Registration) are queried with these full-instant
 * bounds specifically to avoid repeating that gap, not because the two
 * modules disagree on what "inclusive" means.
 */
export type DateRangePreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "prevMonth";

export interface ResolvedDateRange extends DateRange {
  preset: DateRangePreset | "custom";
}

const IST_TZ = "Asia/Kolkata";
const DAY_MS = 86_400_000;

function istDateString(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: IST_TZ }); // en-CA formats as YYYY-MM-DD.
}

function istParts(ms: number): { year: number; month: number } {
  const [year, month] = istDateString(ms).split("-").map(Number);
  return { year, month };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The UTC instant of 00:00:00.000 IST on the given YYYY-MM-DD date. */
function istStartOfDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000+05:30`).toISOString();
}

/** The UTC instant of 23:59:59.999 IST on the given YYYY-MM-DD date. */
function istEndOfDay(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999+05:30`).toISOString();
}

function dayRange(dateStr: string): DateRange {
  return { from: istStartOfDay(dateStr), to: istEndOfDay(dateStr) };
}

function resolvePreset(preset: DateRangePreset, nowMs: number): DateRange {
  switch (preset) {
    case "today":
      return dayRange(istDateString(nowMs));
    case "yesterday":
      return dayRange(istDateString(nowMs - DAY_MS));
    case "last7":
      return { from: istStartOfDay(istDateString(nowMs - 6 * DAY_MS)), to: istEndOfDay(istDateString(nowMs)) };
    case "last30":
      return { from: istStartOfDay(istDateString(nowMs - 29 * DAY_MS)), to: istEndOfDay(istDateString(nowMs)) };
    case "thisMonth": {
      const { year, month } = istParts(nowMs);
      return { from: istStartOfDay(`${year}-${pad2(month)}-01`), to: istEndOfDay(istDateString(nowMs)) };
    }
    case "prevMonth": {
      const { year, month } = istParts(nowMs);
      const firstOfThisMonthMs = Date.parse(istStartOfDay(`${year}-${pad2(month)}-01`));
      const lastDayOfPrevMonth = istDateString(firstOfThisMonthMs - 1); // one ms before this month started, read back as an IST date.
      const { year: py, month: pm } = istParts(firstOfThisMonthMs - 1);
      return { from: istStartOfDay(`${py}-${pad2(pm)}-01`), to: istEndOfDay(lastDayOfPrevMonth) };
    }
  }
}

const VALID_PRESETS: DateRangePreset[] = ["today", "yesterday", "last7", "last30", "thisMonth", "prevMonth"];

/**
 * GET query params: `?preset=last30` (one of DateRangePreset) OR
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD` (Custom Range — both bounds
 * normalized to IST day start/end the same way every preset is).
 * Defaults to `last30` when neither is supplied, matching
 * /api/admin/marketing's own existing default window.
 */
export function resolveDateRangeFromParams(searchParams: URLSearchParams, nowMs: number = Date.now()): ResolvedDateRange {
  const presetParam = searchParams.get("preset");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (fromParam && toParam) {
    const range = { from: istStartOfDay(fromParam), to: istEndOfDay(toParam) };
    return { ...range, preset: "custom" };
  }

  const preset: DateRangePreset = VALID_PRESETS.includes(presetParam as DateRangePreset) ? (presetParam as DateRangePreset) : "last30";
  return { ...resolvePreset(preset, nowMs), preset };
}

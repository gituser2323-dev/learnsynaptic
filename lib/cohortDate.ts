const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Live cohorts kick off Saturday 8:30 PM IST. */
const COHORT_START_MINUTES_IST = 20 * 60 + 30;

/**
 * Returns the exact instant of the next upcoming Saturday 8:30 PM IST,
 * computed from pure UTC arithmetic (never the browser's local timezone),
 * so it resolves correctly for any visitor and rolls forward forever with
 * no hardcoded cohort dates to maintain.
 */
export function getNextCohortSaturday(nowMs: number = Date.now()): Date {
  const istNow = nowMs + IST_OFFSET_MS;
  const istDayStart = Math.floor(istNow / DAY_MS) * DAY_MS;
  const istWeekday = new Date(istDayStart).getUTCDay(); // 0=Sun … 6=Sat
  const daysUntilSaturday = (6 - istWeekday + 7) % 7;

  let targetIstInstant = istDayStart + daysUntilSaturday * DAY_MS + COHORT_START_MINUTES_IST * 60 * 1000;
  if (targetIstInstant <= istNow) {
    targetIstInstant += 7 * DAY_MS;
  }

  return new Date(targetIstInstant - IST_OFFSET_MS);
}

/** Calendar day/month for a date, read in IST regardless of the visitor's
 *  local timezone — so the displayed date always matches the cohort's
 *  actual IST calendar date. `month` is 0-indexed. */
export function getIstDateParts(date: Date): { day: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value) - 1;
  return { day, month };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const THURSDAY_START_MINUTES_IST = 20 * 60; // 8:00 PM
const SUNDAY_START_MINUTES_IST = 11 * 60; // 11:00 AM

/** Next instant of a given IST weekday (0=Sun...6=Sat) at the given
 *  minute-of-day, strictly after `nowMs`. Pure UTC arithmetic — never the
 *  browser's local timezone — so it resolves the same for every visitor. */
function nextWeekdayInstant(nowMs: number, targetWeekday: number, startMinutesIst: number): number {
  const istNow = nowMs + IST_OFFSET_MS;
  const istDayStart = Math.floor(istNow / DAY_MS) * DAY_MS;
  const istWeekday = new Date(istDayStart).getUTCDay();
  const daysUntilTarget = (targetWeekday - istWeekday + 7) % 7;

  let targetIstInstant = istDayStart + daysUntilTarget * DAY_MS + startMinutesIst * 60 * 1000;
  if (targetIstInstant <= istNow) {
    targetIstInstant += 7 * DAY_MS;
  }
  return targetIstInstant - IST_OFFSET_MS;
}

/**
 * Live masterclasses alternate Thursday 8:00 PM IST and Sunday 11:00 AM
 * IST — whichever of those two upcoming slots is sooner is "next." That
 * single rule produces the alternation on its own (Thu→Sun is +3 days,
 * Sun→Thu is +4), with no cohort date to hardcode or roll forward by
 * hand — every route sharing this calendar always reads the same live
 * answer.
 */
export function getNextSessionDate(nowMs: number = Date.now()): Date {
  const nextThursday = nextWeekdayInstant(nowMs, 4, THURSDAY_START_MINUTES_IST);
  const nextSunday = nextWeekdayInstant(nowMs, 0, SUNDAY_START_MINUTES_IST);
  return new Date(Math.min(nextThursday, nextSunday));
}

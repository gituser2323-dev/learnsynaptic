import { getNextSessionDate } from "@/lib/masterclassSchedule";

const IST_TZ = "Asia/Kolkata";

function part(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: IST_TZ, ...options }).format(date);
}

export interface SessionParts {
  date: Date;
  weekday: string;
  day: number;
  month: string;
  time: string;
}

/** Breaks the next live, alternating-schedule session (Thursday 8:00 PM /
 *  Sunday 11:00 AM IST — see lib/masterclassSchedule.ts) into the pieces
 *  every date/time display on the page needs, so they always agree and
 *  never need a hardcoded cohort date maintained by hand. */
export function getSessionParts(date: Date = getNextSessionDate()): SessionParts {
  return {
    date,
    weekday: part(date, { weekday: "long" }),
    day: Number(part(date, { day: "numeric" })),
    month: part(date, { month: "long" }),
    time: part(date, { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

/** Hero top badge, e.g. "THURSDAY • 21 AUGUST • 8:00 PM". */
export function formatBadgeDate(date?: Date): string {
  const { weekday, day, month, time } = getSessionParts(date);
  return `${weekday} • ${day} ${month} • ${time}`.toUpperCase();
}

/** Closing CTA, e.g. "Thursday, 21 August, 8:00 PM". */
export function formatClosingDate(date?: Date): string {
  const { weekday, day, month, time } = getSessionParts(date);
  return `${weekday}, ${day} ${month}, ${time}`;
}

/** Floating CTA, e.g. "Thursday, 21 August • 8:00 PM Onwards". */
export function formatFloatingDate(date?: Date): string {
  const { weekday, day, month, time } = getSessionParts(date);
  return `${weekday}, ${day} ${month} • ${time} Onwards`;
}

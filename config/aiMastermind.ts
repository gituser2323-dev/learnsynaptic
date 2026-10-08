/**
 * Single source of truth for the /ai-mastermind landing page's event details.
 */
const COMMUNITY_PHONE = "919119421273"; // +91 91194 21273

export const AI_MASTERMIND = {
  sessionWeekdays: [0, 1, 3, 5] as readonly number[], // Sun, Mon, Wed, Fri
  fallbackLabel: "Mon · Wed · Fri · Sun",
  format: "1 Day · Live & Hands-on",
  priceInr: 199,
  communityUrl: `https://wa.me/${COMMUNITY_PHONE}?text=${encodeURIComponent("Hi! I want to join the LearnSynaptic AI Community.")}`,
  leadProgram: "1-Day AI Mastermind",
  leadSource: "ai-mastermind-modal",
  leadBadge: "1-DAY LIVE AI MASTERMIND · ₹199",
} as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
}

/** The next upcoming session date (today counts until the day ends in IST), e.g. "Fri, 9th Oct". */
export function getNextSessionLabel(now: Date = new Date()): string {
  const ist = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  // Work in UTC so the calendar math ignores the machine's own timezone.
  const d = new Date(Date.UTC(ist[0], ist[1] - 1, ist[2]));
  while (!AI_MASTERMIND.sessionWeekdays.includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return `${DAYS[d.getUTCDay()]}, ${ordinal(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`;
}

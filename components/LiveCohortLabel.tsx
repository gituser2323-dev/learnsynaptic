"use client";

import { getLiveCohort } from "@/lib/cohortDate";

/** Renders the next Saturday cohort in IST. Computed at render so a static
 *  page cannot keep a past date. `suppressHydrationWarning` covers the rare
 *  case where the server clock and the browser clock disagree by a day. */
export function LiveCohortLabel({ long = false }: { long?: boolean }) {
  const cohort = getLiveCohort();
  return <span suppressHydrationWarning>{long ? cohort.longLabel : cohort.label}</span>;
}

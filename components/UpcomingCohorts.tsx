"use client";

import { getUpcomingCohorts } from "@/lib/cohortDate";
import { StaggerContainer, StaggerItem } from "@/components/ui/AnimateOnScroll";

/** Next three starts on the shared Saturday cadence. No seat counts —
 *  inventory is not tracked, so a number here would be a constant. */
export function UpcomingCohorts() {
  const cohorts = getUpcomingCohorts(3);

  return (
    <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cohorts.map((cohort, index) => (
        <StaggerItem key={cohort.startsAt.toISOString()}>
          <div
            className="rounded-2xl border p-5"
            style={{
              borderColor: index === 0 ? "var(--ls-blue-primary)" : "var(--ls-border)",
              background: index === 0 ? "var(--ls-blue-tint)" : "white",
            }}
          >
            {index === 0 && (
              <span
                className="text-xs font-semibold mb-2 inline-block"
                style={{ color: "var(--ls-blue-primary)" }}
              >
                Next cohort
              </span>
            )}
            <p className="font-bold text-lg mb-1" style={{ color: "var(--ls-text)" }} suppressHydrationWarning>
              {cohort.longLabel}
            </p>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--ls-text)" }}>
              Weekend batch
            </p>
            <p className="text-xs" style={{ color: "var(--ls-muted)" }}>
              {cohort.timeLabel}
            </p>
          </div>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}

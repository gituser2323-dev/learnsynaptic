"use client";

import { useCallback } from "react";
import { analytics } from "./index";
import type { AnalyticsEventParams } from "./types";

/**
 * Returns a stable trackClick(label, location) callback for wiring click
 * tracking into any existing onClick handler without touching markup or
 * styles, e.g.:
 *
 *   const trackClick = useTrackClick();
 *   <button onClick={() => trackClick("enroll_now", "navbar")}>...
 */
export function useTrackClick() {
  return useCallback(
    (label: string, location: string, params?: AnalyticsEventParams) => {
      analytics.trackClick(label, location, params);
    },
    [],
  );
}

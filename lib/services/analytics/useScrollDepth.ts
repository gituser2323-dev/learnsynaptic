"use client";

import { useEffect, useRef } from "react";
import { analytics } from "./index";

const THRESHOLDS = [25, 50, 75, 100] as const;

/**
 * Fires a ScrollDepth event once per threshold (25/50/75/100%) for the
 * lifetime of the mounted component. The caller is responsible for
 * remounting this hook on route change (see components/analytics/
 * ScrollDepthTracker.tsx, which keys its child by pathname) so thresholds
 * reset per page view instead of carrying over across navigations.
 */
export function useScrollDepth(): void {
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const scrolledPct = Math.round((scrollTop / docHeight) * 100);

      for (const threshold of THRESHOLDS) {
        if (scrolledPct >= threshold && !firedRef.current.has(threshold)) {
          firedRef.current.add(threshold);
          analytics.track("ScrollDepth", { depth: threshold });
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
}

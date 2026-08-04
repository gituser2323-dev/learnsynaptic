"use client";

import { usePathname } from "next/navigation";
import { useScrollDepth } from "@/lib/services/analytics/useScrollDepth";

function ScrollDepthListener() {
  useScrollDepth();
  return null;
}

/**
 * Mounts scroll-depth tracking globally (once, from the root layout).
 * Keyed by pathname so navigating to a new page remounts the listener and
 * resets its fired-thresholds set, instead of carrying thresholds over
 * from whatever page the user scrolled on previously.
 */
export function ScrollDepthTracker() {
  const pathname = usePathname();
  return <ScrollDepthListener key={pathname} />;
}

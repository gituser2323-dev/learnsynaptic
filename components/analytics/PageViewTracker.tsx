"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analytics, captureUtmParams } from "@/lib/services/analytics";

/**
 * Fires a PageView event (all configured providers) and captures/persists
 * UTM params on every route change, including client-side navigations the
 * provider scripts' own auto-pageview logic won't see under the App
 * Router. Renders nothing.
 *
 * Must be rendered inside a <Suspense> boundary — useSearchParams()
 * requires one in the App Router, both in dev and at build time.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const fullPath = query ? `${pathname}?${query}` : pathname;

    captureUtmParams(searchParams, pathname);
    analytics.pageview(fullPath);
  }, [pathname, searchParams]);

  return null;
}

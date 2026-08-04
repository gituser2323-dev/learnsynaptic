import { IS_META_PIXEL_ENABLED } from "@/config/analytics";
import type {
  AnalyticsEventName,
  AnalyticsEventParams,
  AnalyticsProvider,
} from "../types";

/**
 * Events that map onto Meta's own "standard events" (fbq('track', ...)) —
 * these are the ones Meta's ad-delivery/optimization algorithms recognize.
 * Everything else goes through fbq('trackCustom', ...) instead.
 */
const META_STANDARD_EVENTS: ReadonlySet<AnalyticsEventName> = new Set([
  "PageView",
  "Lead",
  "CompleteRegistration",
]);

function callFbq(...args: unknown[]): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq(...args);
}

export const metaPixelProvider: AnalyticsProvider = {
  id: "meta-pixel",

  isReady() {
    return (
      IS_META_PIXEL_ENABLED &&
      typeof window !== "undefined" &&
      typeof window.fbq === "function"
    );
  },

  pageview() {
    if (!this.isReady()) return;
    callFbq("track", "PageView");
  },

  track(event: AnalyticsEventName, params: AnalyticsEventParams = {}) {
    if (!this.isReady()) return;
    if (META_STANDARD_EVENTS.has(event)) {
      callFbq("track", event, params);
    } else {
      callFbq("trackCustom", event, params);
    }
  },
};

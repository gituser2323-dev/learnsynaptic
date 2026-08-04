import { IS_GA4_ENABLED } from "@/config/analytics";
import type {
  AnalyticsEventName,
  AnalyticsEventParams,
  AnalyticsProvider,
} from "../types";

/** Maps our canonical event names to GA4's own recommended-event vocabulary. */
const GA4_EVENT_MAP: Record<AnalyticsEventName, string> = {
  PageView: "page_view",
  Lead: "generate_lead",
  CompleteRegistration: "sign_up",
  ButtonClick: "button_click",
  ScrollDepth: "scroll_depth",
};

function callGtag(...args: unknown[]): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag(...args);
}

export const ga4Provider: AnalyticsProvider = {
  id: "ga4",

  isReady() {
    return (
      IS_GA4_ENABLED &&
      typeof window !== "undefined" &&
      typeof window.gtag === "function"
    );
  },

  pageview(path: string, params: AnalyticsEventParams = {}) {
    if (!this.isReady()) return;
    callGtag("event", "page_view", { page_path: path, ...params });
  },

  track(event: AnalyticsEventName, params: AnalyticsEventParams = {}) {
    if (!this.isReady()) return;
    callGtag("event", GA4_EVENT_MAP[event], params);
  },
};

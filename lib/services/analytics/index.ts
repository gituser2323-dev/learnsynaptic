import { ga4Provider } from "./providers/ga4.provider";
import { metaPixelProvider } from "./providers/metaPixel.provider";
import { getAttribution } from "./utm";
import type {
  AnalyticsEventName,
  AnalyticsEventParams,
  AnalyticsProvider,
} from "./types";

export type {
  AnalyticsEventName,
  AnalyticsEventParams,
  AttributionRecord,
  AttributionTouch,
  UtmParams,
} from "./types";
export { captureUtmParams, getAttribution } from "./utm";

/**
 * Every provider the app knows about. A provider that isn't configured
 * (no ID set in config/analytics.ts) simply no-ops via isReady() — it
 * never needs to be removed from this list for local/dev use. Add a new
 * provider by implementing AnalyticsProvider and appending it here; no
 * other file in the app needs to change.
 */
const providers: AnalyticsProvider[] = [ga4Provider, metaPixelProvider];

function withAttribution(params: AnalyticsEventParams = {}): AnalyticsEventParams {
  const attribution = getAttribution();
  if (!attribution) return params;
  return {
    ...params,
    utm_source: attribution.last.utm_source,
    utm_medium: attribution.last.utm_medium,
    utm_campaign: attribution.last.utm_campaign,
  };
}

export const analytics = {
  pageview(path: string, params?: AnalyticsEventParams): void {
    const enriched = withAttribution(params);
    providers.forEach((provider) => provider.pageview(path, enriched));
  },

  track(event: AnalyticsEventName, params?: AnalyticsEventParams): void {
    const enriched = withAttribution(params);
    providers.forEach((provider) => provider.track(event, enriched));
  },

  /** Convenience wrapper for the common "button click" case. */
  trackClick(label: string, location: string, params?: AnalyticsEventParams): void {
    this.track("ButtonClick", { label, location, ...params });
  },
};

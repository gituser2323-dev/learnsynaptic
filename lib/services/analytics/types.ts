/**
 * Provider-agnostic analytics contract. Every provider adapter (GA4, Meta
 * Pixel, and anything added later) implements AnalyticsProvider against
 * this canonical event vocabulary — call sites never reference a vendor
 * SDK or vendor-specific event name directly.
 */

export type AnalyticsEventName =
  | "PageView"
  | "Lead"
  | "CompleteRegistration"
  | "ButtonClick"
  | "ScrollDepth";

export interface AnalyticsEventParams {
  [key: string]: string | number | boolean | undefined;
}

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
}

export interface AttributionTouch extends UtmParams {
  landingPath: string;
  referrer: string;
  capturedAt: string;
}

export interface AttributionRecord {
  /** Set once, on the visit that first carried tracking params. */
  first: AttributionTouch;
  /** Overwritten on every visit that carries new tracking params. */
  last: AttributionTouch;
}

export interface AnalyticsProvider {
  /** Stable id used for registry membership and debug logging. */
  readonly id: string;
  /** True once this provider's script has loaded and it's safe to call. */
  isReady(): boolean;
  pageview(path: string, params?: AnalyticsEventParams): void;
  track(event: AnalyticsEventName, params?: AnalyticsEventParams): void;
}

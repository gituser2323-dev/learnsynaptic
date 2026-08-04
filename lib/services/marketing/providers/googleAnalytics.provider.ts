import { MarketingProviderNotImplementedError } from "../errors";
import type { WebAnalyticsMetrics, WebAnalyticsProvider } from "../types";

/**
 * GA4 Data API adapter — SCAFFOLD ONLY, not yet integrated. Distinct from
 * lib/services/analytics (the client-side gtag.js tracker built in
 * Module 2, which *sends* PageView/Lead/CompleteRegistration events):
 * this reads aggregated reports back, server-side, via a service account.
 *
 * Illustrative sketch (verify current field/method names against Google's
 * Analytics Data API v1beta docs before implementing):
 *
 *   POST https://analyticsdata.googleapis.com/v1beta/properties/
 *        {GOOGLE_ANALYTICS_CONFIG.propertyId}:runReport
 *     Body: { dateRanges: [{ startDate: range.from, endDate: range.to }],
 *       metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "screenPageViews" }] }
 *     Auth: JWT signed with GOOGLE_ANALYTICS_CONFIG.serviceAccountPrivateKey
 *       (the official @google-analytics/data client library handles this
 *       token exchange rather than hand-rolling it).
 */
export const googleAnalyticsProvider: WebAnalyticsProvider = {
  id: "google-analytics",

  async getMetrics(): Promise<WebAnalyticsMetrics> {
    throw new MarketingProviderNotImplementedError(this.id);
  },
};

import type { WebAnalyticsMetrics, WebAnalyticsProvider } from "../types";

/**
 * Default WebAnalyticsProvider — selected whenever
 * MARKETING_WEB_ANALYTICS_PROVIDER is unset (config/marketing.ts). Same
 * role as noAdsData.provider.ts: always succeeds, always reports
 * dataAvailable: false.
 */
export const noWebAnalyticsDataProvider: WebAnalyticsProvider = {
  id: "none",

  async getMetrics(): Promise<WebAnalyticsMetrics> {
    return { sessions: 0, users: 0, pageViews: 0, dataAvailable: false };
  },
};

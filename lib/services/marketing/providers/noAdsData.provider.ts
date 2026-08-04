import type { AdMetrics, AdsProvider } from "../types";

/**
 * Default AdsProvider — selected whenever MARKETING_ADS_PROVIDER is unset
 * (config/marketing.ts). Always succeeds, always reports
 * dataAvailable: false, so the rest of the dashboard (funnels, campaign
 * metrics) can run and be verified with no ad account connected — the
 * same role as WhatsApp's console.provider.ts, except it reports absence
 * instead of logging a fake send.
 */
export const noAdsDataProvider: AdsProvider = {
  id: "none",

  async getMetrics(): Promise<AdMetrics> {
    return { impressions: 0, clicks: 0, spend: 0, currency: "INR", dataAvailable: false };
  },
};

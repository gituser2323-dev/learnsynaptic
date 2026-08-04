import { MARKETING_ACTIVE_ADS_PROVIDER, MARKETING_ACTIVE_WEB_ANALYTICS_PROVIDER } from "@/config/marketing";
import { noAdsDataProvider } from "./providers/noAdsData.provider";
import { metaAdsProvider } from "./providers/metaAds.provider";
import { noWebAnalyticsDataProvider } from "./providers/noWebAnalyticsData.provider";
import { googleAnalyticsProvider } from "./providers/googleAnalytics.provider";
import { paymentsRevenueProvider } from "./providers/payments.revenue.provider";
import type { AdsProvider, AdsProviderId, RevenueProvider, WebAnalyticsProvider, WebAnalyticsProviderId } from "./types";

/**
 * The single seam where a provider id (config, driven by
 * MARKETING_ADS_PROVIDER / MARKETING_WEB_ANALYTICS_PROVIDER) becomes a
 * concrete provider instance — same role as lib/services/whatsapp/
 * registry.ts. This file is the only place in the app allowed to import a
 * concrete provider adapter; funnels.ts and campaignMetrics.ts depend
 * only on the AdsProvider/WebAnalyticsProvider/RevenueProvider interfaces.
 */

const adsRegistry: Record<AdsProviderId, AdsProvider> = {
  none: noAdsDataProvider,
  "meta-ads": metaAdsProvider,
};

const webAnalyticsRegistry: Record<WebAnalyticsProviderId, WebAnalyticsProvider> = {
  none: noWebAnalyticsDataProvider,
  "google-analytics": googleAnalyticsProvider,
};

export function getAdsProvider(): AdsProvider {
  return adsRegistry[MARKETING_ACTIVE_ADS_PROVIDER];
}

export function getWebAnalyticsProvider(): WebAnalyticsProvider {
  return webAnalyticsRegistry[MARKETING_ACTIVE_WEB_ANALYTICS_PROVIDER];
}

/** Payments Integration (Phase 6), Module 6.4 — a real implementation
 *  now exists (payments.revenue.provider.ts), replacing the honest
 *  "unavailable" placeholder this seam previously returned
 *  unconditionally (the now-deleted noRevenueData.provider.ts — its
 *  own doc comment predicted exactly this replacement). No
 *  config-driven selection like getAdsProvider()/getWebAnalyticsProvider()
 *  — there's no vendor choice to make here, Payments either exists in
 *  this codebase or it doesn't, and now it does. */
export function getRevenueProvider(): RevenueProvider {
  return paymentsRevenueProvider;
}

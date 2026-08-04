/**
 * Marketing Dashboard — public surface (Module 8, architecture only).
 * Everything else in this directory (providers/, registry.ts, errors.ts)
 * is an implementation detail; callers import only from here — same
 * enforcement pattern as lib/services/whatsapp and lib/services/leads.
 */
export { getLeadFunnel, getConversionFunnel, getRevenueFunnel } from "./funnels";
export { getCampaignMarketingMetrics, getOverallMarketingMetrics } from "./campaignMetrics";
export { calculateCtr, calculateCpc, calculateCpa, calculateRoas, safeDivide } from "./metrics";
export { MarketingProviderNotImplementedError } from "./errors";
export type {
  DateRange,
  AdsProviderId,
  AdMetrics,
  AdsProvider,
  WebAnalyticsProviderId,
  WebAnalyticsMetrics,
  WebAnalyticsProvider,
  RevenueMetrics,
  RevenueProvider,
  DerivedAdMetrics,
  LeadFunnel,
  ConversionFunnel,
  RevenueFunnel,
  CampaignMarketingMetrics,
  OverallMarketingMetrics,
} from "./types";

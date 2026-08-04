import { campaignService } from "@/lib/services/campaigns";
import { registrationService } from "@/lib/services/registrations";
import { createLogger } from "@/lib/logger";
import { getAdsProvider } from "./registry";
import { calculateCpa, calculateCpc, calculateCtr, calculateRoas } from "./metrics";
import { getRevenueFunnel } from "./funnels";
import type {
  AdMetrics,
  CampaignMarketingMetrics,
  DateRange,
  DerivedAdMetrics,
  OverallMarketingMetrics,
} from "./types";

const logger = createLogger({ service: "marketing" });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const UNAVAILABLE_AD_METRICS: AdMetrics = {
  impressions: 0,
  clicks: 0,
  spend: 0,
  currency: "INR",
  dataAvailable: false,
};

/**
 * Marketing Dashboard — Campaign Metrics: combines this app's own
 * Campaign.registrationCount (real data) with ad spend/impressions/clicks
 * for that campaign's externalAdCampaignId (lib/db — set only for
 * campaigns actually running paid ads).
 *
 * Per-campaign ROAS is deliberately always null: revenue isn't attributed
 * per-campaign anywhere in this app (no Payments module — see
 * funnels.ts's getRevenueFunnel doc), so there is nothing correct to
 * divide by spend at this granularity. Account-wide ROAS is still
 * computable — see getOverallMarketingMetrics below.
 */
export async function getCampaignMarketingMetrics(
  campaignId: string,
  range: DateRange,
): Promise<CampaignMarketingMetrics | null> {
  const campaign = await campaignService.getCampaignById(campaignId);
  if (!campaign) return null;

  let ads = UNAVAILABLE_AD_METRICS;
  try {
    ads = await getAdsProvider().getMetrics(campaign.externalAdCampaignId, range);
  } catch (error) {
    logger.warn("marketing.ads_unavailable", { campaignId, error: errorMessage(error) });
  }

  const derived: DerivedAdMetrics = {
    ctr: calculateCtr(ads.clicks, ads.impressions),
    cpc: calculateCpc(ads.spend, ads.clicks),
    cpa: calculateCpa(ads.spend, campaign.registrationCount),
    roas: null,
  };

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    registrations: campaign.registrationCount,
    ads,
    derived,
  };
}

/** Reasonable cap on how many campaigns get summed into the account-wide
 *  total in one call — a dashboard read, not an unbounded export (CSV
 *  export, if this ever needs one, would page through instead). */
const MAX_CAMPAIGNS_FOR_OVERALL_METRICS = 200;

/**
 * Marketing Dashboard — account-wide CTR/CPC/CPA/ROAS: sums ad spend
 * across every campaign that has an externalAdCampaignId, combined with
 * this app's total registrations (conversions) and, when available, the
 * Revenue Funnel's total revenue. This is where a real, non-null ROAS
 * becomes possible even though per-campaign ROAS never is.
 */
export async function getOverallMarketingMetrics(range: DateRange): Promise<OverallMarketingMetrics> {
  const campaigns = await campaignService.listCampaigns({}, 1, MAX_CAMPAIGNS_FOR_OVERALL_METRICS);
  const adsProvider = getAdsProvider();

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let adDataAvailable = false;

  for (const campaign of campaigns.items) {
    try {
      const metrics = await adsProvider.getMetrics(campaign.externalAdCampaignId, range);
      if (metrics.dataAvailable) adDataAvailable = true;
      totalSpend += metrics.spend;
      totalImpressions += metrics.impressions;
      totalClicks += metrics.clicks;
    } catch (error) {
      logger.warn("marketing.ads_unavailable", { campaignId: campaign.id, error: errorMessage(error) });
    }
  }

  const [registrationAnalytics, revenueFunnel] = await Promise.all([
    registrationService.getAnalytics(),
    getRevenueFunnel(range),
  ]);

  return {
    totalAdSpend: totalSpend,
    totalImpressions,
    totalClicks,
    adDataAvailable,
    ctr: calculateCtr(totalClicks, totalImpressions),
    cpc: calculateCpc(totalSpend, totalClicks),
    cpa: calculateCpa(totalSpend, registrationAnalytics.totalRegistrations),
    roas: revenueFunnel.totalRevenueInr !== null ? calculateRoas(revenueFunnel.totalRevenueInr, totalSpend) : null,
  };
}

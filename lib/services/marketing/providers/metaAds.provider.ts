import { MarketingProviderNotImplementedError } from "../errors";
import type { AdMetrics, AdsProvider } from "../types";

/**
 * Meta Marketing API (Ads Insights) adapter — SCAFFOLD ONLY, not yet
 * integrated. Same status as lib/services/whatsapp/providers/aisensy.
 * provider.ts and its siblings: the interface is real, the vendor call
 * is not written.
 *
 * Illustrative sketch (verify current field names against Meta's Graph
 * API docs before implementing):
 *
 *   GET https://graph.facebook.com/{META_ADS_CONFIG.apiVersion}/
 *       {externalCampaignId ?? META_ADS_CONFIG.adAccountId}/insights
 *     ?fields=impressions,clicks,spend
 *     &time_range={"since":range.from,"until":range.to}
 *     &access_token={META_ADS_CONFIG.accessToken}
 *
 * Note the account-level vs. campaign-level endpoint distinction: when
 * externalCampaignId is undefined (see getOverallMarketingMetrics in
 * campaignMetrics.ts), query the ad account node instead of a specific
 * campaign node.
 */
export const metaAdsProvider: AdsProvider = {
  id: "meta-ads",

  async getMetrics(): Promise<AdMetrics> {
    throw new MarketingProviderNotImplementedError(this.id);
  },
};

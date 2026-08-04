import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";
import { safeDivide } from "@/lib/services/marketing";
import { getRevenueAttribution } from "./attributionService";
import type { WhatsAppCampaignRevenueEntry, WhatsAppRevenueResult } from "./whatsappRevenueTypes";
import type { DateRange } from "./types";

const MAX_CAMPAIGNS_IN_RESPONSE = 50;

/**
 * Enterprise Analytics (Phase 7), module 7.2 — WhatsApp Performance +
 * Revenue (mission §8). Reuses attributionService's own
 * "whatsappCampaign" dimension for revenue/conversions (the same
 * last-touch join, computed once) rather than re-deriving it here — see
 * ./whatsappRevenueTypes.ts's own module doc.
 */
export async function getWhatsAppRevenue(range: DateRange): Promise<WhatsAppRevenueResult> {
  const [campaignsPage, attribution] = await Promise.all([
    whatsappCampaignService.listCampaigns({}, 1, MAX_CAMPAIGNS_IN_RESPONSE),
    getRevenueAttribution(range),
  ]);

  const whatsappDimension = attribution.dimensions.find((d) => d.dimension === "whatsappCampaign");
  const revenueByCampaignId = new Map((whatsappDimension?.rows ?? []).map((r) => [r.key, r]));

  const campaigns: WhatsAppCampaignRevenueEntry[] = campaignsPage.items.map((campaign) => {
    const attributionRow = revenueByCampaignId.get(campaign.id);
    const revenueInr = attributionRow?.revenueInr ?? 0;
    const conversions = attributionRow?.paymentCount ?? 0;

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      failedCount: campaign.failedCount,
      replyCount: campaign.replyCount,
      clickCount: campaign.clickCount,
      deliveryRatePct: percentOrNull(safeDivide(campaign.deliveredCount, campaign.sentCount)),
      readRatePct: percentOrNull(safeDivide(campaign.readCount, campaign.deliveredCount)),
      replyRatePct: percentOrNull(safeDivide(campaign.replyCount, campaign.deliveredCount)),
      leadsGenerated: null,
      revenueInr,
      conversions,
      conversionRatePct: percentOrNull(safeDivide(conversions, campaign.deliveredCount)),
    };
  });

  campaigns.sort((a, b) => b.revenueInr - a.revenueInr);

  return { range, campaigns };
}

function percentOrNull(ratio: number | null): number | null {
  return ratio === null ? null : ratio * 100;
}

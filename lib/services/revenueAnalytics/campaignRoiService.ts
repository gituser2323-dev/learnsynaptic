import { getPaymentRepository } from "@/lib/db";
import { campaignService } from "@/lib/services/campaigns";
import { leadService } from "@/lib/services/leads";
import { registrationService } from "@/lib/services/registrations";
import { getCampaignMarketingMetrics, calculateCpa, calculateRoas, safeDivide } from "@/lib/services/marketing";
import type { CampaignRoiEntry, CampaignRoiResult } from "./campaignRoiTypes";
import type { DateRange } from "./types";

const MAX_CAMPAIGNS_IN_RESPONSE = 50;
const MAX_PAYMENTS_FOR_ANALYTICS = 10_000;

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Campaign ROI (mission
 * §7), for the marketing Campaign entity. See ./campaignRoiTypes.ts's
 * own module doc: spend reuses getCampaignMarketingMetrics()
 * (lib/services/marketing) rather than re-querying the AdsProvider
 * directly — that function already IS this app's one real ad-spend
 * lookup, no second one is created here.
 */
export async function getCampaignRoi(range: DateRange): Promise<CampaignRoiResult> {
  const [campaignsPage, paymentsPage] = await Promise.all([
    campaignService.listCampaigns({}, 1, MAX_CAMPAIGNS_IN_RESPONSE),
    (await getPaymentRepository()).list({ status: "succeeded", createdAfter: range.from, createdBefore: range.to }, 1, MAX_PAYMENTS_FOR_ANALYTICS),
  ]);

  const succeededInr = paymentsPage.items.filter((p) => p.currency === "INR");
  const revenueByCampaignId = new Map<string, number>();
  for (const p of succeededInr) {
    if (!p.campaignId) continue;
    revenueByCampaignId.set(p.campaignId, (revenueByCampaignId.get(p.campaignId) ?? 0) + p.amountInSmallestUnit / 100);
  }

  const campaigns: CampaignRoiEntry[] = await Promise.all(
    campaignsPage.items.map(async (campaign) => {
      const [marketingMetrics, registrationsInRangeResult, conversionsResult, leadsResult] = await Promise.all([
        getCampaignMarketingMetrics(campaign.id, range),
        registrationService.listRegistrations({ campaignId: campaign.id, createdAfter: range.from, createdBefore: range.to }, 1, 1),
        registrationService.listRegistrations(
          { campaignId: campaign.id, status: "confirmed", createdAfter: range.from, createdBefore: range.to },
          1,
          1,
        ),
        campaign.utmCampaign
          ? leadService.listLeads({ utmCampaign: campaign.utmCampaign, createdAfter: range.from, createdBefore: range.to }, 1, 1)
          : Promise.resolve(null),
      ]);

      const adsAvailable = marketingMetrics?.ads.dataAvailable ?? false;
      const spendInr = adsAvailable ? marketingMetrics!.ads.spend : (campaign.budgetInr ?? 0);
      const spendSource: CampaignRoiEntry["spendSource"] = adsAvailable
        ? "ads_provider"
        : campaign.budgetInr
          ? "budget_field"
          : "unavailable";

      const leads = leadsResult?.total ?? 0;
      const conversions = conversionsResult.total;
      const revenueInr = revenueByCampaignId.get(campaign.id) ?? 0;

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        spendInr,
        spendSource,
        leads,
        leadMatchAvailable: !!campaign.utmCampaign,
        registrationsInRange: registrationsInRangeResult.total,
        lifetimeRegistrations: campaign.registrationCount,
        conversions,
        revenueInr,
        cpl: safeDivide(spendInr, leads),
        cpa: calculateCpa(spendInr, conversions),
        roas: calculateRoas(revenueInr, spendInr),
        roiPct: spendInr === 0 ? null : ((revenueInr - spendInr) / spendInr) * 100,
      };
    }),
  );

  campaigns.sort((a, b) => b.revenueInr - a.revenueInr);

  return { range, campaigns };
}

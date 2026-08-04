import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { campaignService } from "@/lib/services/campaigns";
import {
  getLeadFunnel,
  getConversionFunnel,
  getRevenueFunnel,
  getOverallMarketingMetrics,
  getCampaignMarketingMetrics,
} from "@/lib/services/marketing";
import type { DateRange } from "@/lib/services/marketing";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;
/** How many campaigns get a per-campaign breakdown in one response — a
 *  dashboard-scale read, not an export (see campaignMetrics.ts's own cap
 *  on the account-wide sum for the same reasoning). */
const MAX_CAMPAIGNS_IN_RESPONSE = 50;

function resolveDateRange(searchParams: URLSearchParams): DateRange {
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const from =
    searchParams.get("from") || new Date(Date.now() - DEFAULT_RANGE_DAYS * DAY_MS).toISOString().slice(0, 10);
  return { from, to };
}

/**
 * GET /api/admin/marketing
 *
 * Marketing Dashboard (Module 8) — architecture only: Lead/Conversion/
 * Revenue funnels, account-wide CTR/CPC/CPA/ROAS, and a per-campaign ad
 * breakdown, in one consolidated payload (same reasoning as
 * /api/admin/analytics: a dashboard fetches all of these together, and
 * each is still an independently-callable service method underneath —
 * see lib/services/marketing).
 *
 * Meta Ads and Google Analytics are scaffolded, not integrated (see
 * lib/services/marketing/providers) — with no provider configured, ad/
 * traffic fields report dataAvailable: false / null rather than 0.
 * Revenue Funnel fields are always null: no Payments module exists yet.
 *
 * ⚠️ requiredRole: "admin" — fails closed until real auth exists, same
 * as every route in the Admin Dashboard Backend module.
 */
async function handleGetMarketing(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const range = resolveDateRange(searchParams);

  const [leadFunnel, conversionFunnel, revenueFunnel, overall, campaignsPage] = await Promise.all([
    getLeadFunnel(range),
    getConversionFunnel(range),
    getRevenueFunnel(range),
    getOverallMarketingMetrics(range),
    campaignService.listCampaigns({}, 1, MAX_CAMPAIGNS_IN_RESPONSE),
  ]);

  const campaigns = await Promise.all(
    campaignsPage.items.map((campaign) => getCampaignMarketingMetrics(campaign.id, range)),
  );

  return apiSuccess({
    range,
    leadFunnel,
    conversionFunnel,
    revenueFunnel,
    overall,
    campaigns: campaigns.filter((c) => c !== null),
  });
}

export const GET = withApiRoute("admin.marketing.get", handleGetMarketing, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

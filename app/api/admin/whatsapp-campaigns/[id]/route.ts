import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * GET /api/admin/whatsapp-campaigns/[id]
 *
 * Campaign detail — status, denormalized rollup counters, plus a live,
 * exact Message aggregation by status (CAMPAIGN_ARCHITECTURE.md §9:
 * the denormalized counters are for Campaign History's list view; a
 * single campaign's own detail view can afford the live aggregation).
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleGetCampaign(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const analytics = await whatsappCampaignService.getCampaignAnalytics(id);
  if (!analytics) {
    throw new NotFoundApiError("WhatsAppCampaign", id);
  }
  return apiSuccess({ campaign: analytics.campaign, messageCounts: analytics.messageCounts });
}

export const GET = withApiRoute("whatsapp_campaigns.get", handleGetCampaign, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

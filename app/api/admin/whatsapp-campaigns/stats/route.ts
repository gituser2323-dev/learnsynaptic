import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * GET /api/admin/whatsapp-campaigns/stats
 *
 * RC-1 — app-wide WhatsApp delivery performance (queued/sent/delivered/
 * read/failed), aggregated across every Message regardless of source.
 * Consumed by the Admin Dashboard Analytics page's WhatsApp section —
 * previously this data existed (per-campaign) but was never surfaced
 * anywhere outside a single campaign's own detail page.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleGetStats(): Promise<NextResponse> {
  const messageCounts = await whatsappCampaignService.getOverallMessageStats();
  return apiSuccess({ messageCounts });
}

export const GET = withApiRoute("whatsapp_campaigns.stats", handleGetStats, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

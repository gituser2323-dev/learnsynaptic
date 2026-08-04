import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { campaignService } from "@/lib/services/campaigns";

/**
 * GET /api/campaigns
 *
 * Public, read-only — the active-campaign listing. Originally also
 * exposed an unauthenticated POST here (create), removed in Business OS
 * Phase 0 hardening: it had zero real callers anywhere in the frontend
 * (confirmed by grepping the whole codebase) and, worse, could not be
 * fixed in place by simply adding `requiredRole: "admin"` — this path
 * isn't in middleware.ts's matcher, so no auth context is ever injected
 * here, meaning a requiredRole check on this route would reject every
 * caller unconditionally, not just non-admins. Campaign creation now
 * lives where every other genuinely admin-only write already lives:
 * POST /api/admin/campaigns (see that route — it also newly fills a real
 * gap, since there was previously no authenticated way to create a
 * Campaign via the API at all, only this unauthenticated one).
 */
async function handleListCampaigns(): Promise<NextResponse> {
  const campaigns = await campaignService.listActiveCampaigns();
  // Caching (Module 10 performance audit): this list changes only when a
  // marketer creates/activates a campaign — not on every request. A
  // short public cache cuts repeat-request load (e.g. a future dashboard
  // polling this) without risking meaningfully stale data; 30s is short
  // enough that "a campaign just went live" is never wrong for long.
  return apiSuccess({ campaigns }, 200, { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" });
}

export const GET = withApiRoute("campaigns.list", handleListCampaigns, {
  rateLimit: { limit: 60, windowMs: 60_000 },
});

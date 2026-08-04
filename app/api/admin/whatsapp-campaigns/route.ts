import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, parsePaginationParams, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";
import type { WhatsAppCampaignListFilters, WhatsAppCampaignStatus } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns, GET /api/admin/whatsapp-campaigns
 *
 * Campaign creation and Campaign History (CAMPAIGN_ARCHITECTURE.md §1,
 * §4). A newly-created campaign starts in "draft" — resolving an
 * audience (POST .../[id]/audience or .../[id]/import) is what moves it
 * to "ready".
 *
 * ⚠️ requiredRole: "admin" — same fail-closed scoping as every route in
 * the Admin Dashboard Backend module.
 */
async function handleCreateCampaign(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  const result = await whatsappCampaignService.createCampaign(body, {
    requestId: ctx.requestId,
    actorId: ctx.authContext.userId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ campaign: result.campaign }, 201);
}

async function handleListCampaigns(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const archivedParam = searchParams.get("archived");
  const filters: WhatsAppCampaignListFilters = {
    status: (searchParams.get("status") as WhatsAppCampaignStatus) || undefined,
    search: searchParams.get("search") || undefined,
    archived: archivedParam === null ? undefined : archivedParam === "true",
  };

  const { page, limit } = parsePaginationParams(searchParams);
  const result = await whatsappCampaignService.listCampaigns(filters, page, limit);
  return apiSuccess({ ...result });
}

export const POST = withApiRoute("whatsapp_campaigns.create", handleCreateCampaign, {
  requiredRole: "admin",
  // Business OS Phase 8, Module 8.3 — server-enforced at the route
  // level, on top of (not instead of) queue.ts's own per-send
  // metering: a plan without whatsapp_campaigns is rejected before a
  // campaign even gets created, not just at first-send time.
  requiredCapability: "whatsapp_campaigns",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

export const GET = withApiRoute("whatsapp_campaigns.list", handleListCampaigns, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

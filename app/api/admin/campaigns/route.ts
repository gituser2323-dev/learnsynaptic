import { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, parsePaginationParams, toCsv, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { campaignService } from "@/lib/services/campaigns";
import type { CampaignListFilters } from "@/lib/services/campaigns";

/**
 * GET /api/admin/campaigns, POST /api/admin/campaigns
 *
 * Admin Dashboard Backend — Campaign Tracking. GET lists every campaign
 * (not just active — see the public GET /api/campaigns for that),
 * filtered by status/channel, searched by name/code, with
 * registrationCount visible per row; `?format=csv` for a full export.
 *
 * POST added in Business OS Phase 0 hardening — the only way to create a
 * Campaign before this was the public, unauthenticated POST
 * /api/campaigns, which had zero real callers and has been removed (see
 * that route's own doc comment). This fills a genuine gap: there was
 * previously no authenticated create path for this entity at all.
 *
 * ⚠️ requiredRole: "admin" for both — same as every route in this module
 * (see lib/api/roles.ts).
 */
async function handleCreateCampaign(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  const result = await campaignService.createCampaign(body, { requestId: ctx.requestId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ campaign: result.campaign }, 201);
}

async function handleListCampaigns(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filters: CampaignListFilters = {
    status: (searchParams.get("status") as CampaignListFilters["status"]) || undefined,
    channel: (searchParams.get("channel") as CampaignListFilters["channel"]) || undefined,
    search: searchParams.get("search") || undefined,
  };

  const format = searchParams.get("format");
  if (format === "csv") {
    const { items } = await campaignService.listCampaigns(filters, 1, 5000);
    const csv = toCsv(items, [
      { header: "id", value: (c) => c.id },
      { header: "name", value: (c) => c.name },
      { header: "code", value: (c) => c.code },
      { header: "channel", value: (c) => c.channel },
      { header: "status", value: (c) => c.status },
      { header: "registrationCount", value: (c) => c.registrationCount },
      { header: "startDate", value: (c) => c.startDate },
      { header: "endDate", value: (c) => c.endDate },
    ]);
    return new NextResponse(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=campaigns.csv" },
    });
  }

  const { page, limit } = parsePaginationParams(searchParams);
  const result = await campaignService.listCampaigns(filters, page, limit);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.campaigns.list", handleListCampaigns, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.campaigns.create", handleCreateCampaign, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

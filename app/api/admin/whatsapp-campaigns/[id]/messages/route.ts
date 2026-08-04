import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";
import type { MessageStatus } from "@/lib/services/whatsappCampaigns";

/**
 * GET /api/admin/whatsapp-campaigns/[id]/messages
 *
 * Per-recipient diagnostics for a campaign — current Message status,
 * filterable, paginated. MessageAttempt history for a specific message
 * isn't exposed via its own route in this pass (no route needed one
 * yet); the data exists and is queryable directly via
 * getMessageAttemptRepository() for a future addition.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleListMessages(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);

  const result = await whatsappCampaignService.listMessages(
    { campaignId: id, status: (searchParams.get("status") as MessageStatus) || undefined },
    page,
    limit,
  );

  return apiSuccess({ ...result });
}

export const GET = withApiRoute("whatsapp_campaigns.messages.list", handleListMessages, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

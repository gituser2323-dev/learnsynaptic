import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns/[id]/cancel
 *
 * Cancels a "ready", "scheduled", or "sending" campaign
 * (CAMPAIGN_ARCHITECTURE.md §4). Messages already sent are not
 * un-sent (a real WhatsApp message can't be recalled) — but any
 * still-queued send jobs check the owning campaign's status before
 * actually sending and skip themselves once it's "cancelled" (see
 * jobHandlers.ts's handleSendMessage), so cancellation genuinely stops
 * in-flight work rather than only preventing new work from starting.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleCancelCampaign(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const result = await whatsappCampaignService.cancelCampaign(id);

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ campaign: result.campaign });
}

export const POST = withApiRoute("whatsapp_campaigns.cancel", handleCancelCampaign, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

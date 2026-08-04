import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns/[id]/send
 *
 * Immediate Send — enqueues a shared-scheduler job (with the approved
 * 3-attempt/1-5-15-minute retry policy) for every still-queued Message
 * in the campaign, then flips it to "sending" (CAMPAIGN_ARCHITECTURE.md
 * §4, §7). Requires the campaign to be "ready" (audience already
 * resolved via .../audience or .../import).
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleSendNow(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const result = await whatsappCampaignService.sendNow(id, {
    requestId: ctx.requestId,
    actorId: ctx.authContext.userId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ campaign: result.campaign });
}

export const POST = withApiRoute("whatsapp_campaigns.send_now", handleSendNow, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

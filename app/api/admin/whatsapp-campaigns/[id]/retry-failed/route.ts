import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns/[id]/retry-failed
 *
 * Retry Failed (CAMPAIGN_ARCHITECTURE.md §8) — resets every
 * permanently-failed Message in this campaign back to "queued" and
 * re-enqueues a send job for each (the approved 3-attempt/1-5-15-minute
 * policy applies fresh to each retried message), re-attempting only the
 * failures rather than resending to the whole campaign.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleRetryFailed(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const result = await whatsappCampaignService.retryFailed(id, {
    requestId: ctx.requestId,
    actorId: ctx.authContext.userId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ retriedCount: result.retriedCount });
}

export const POST = withApiRoute("whatsapp_campaigns.retry_failed", handleRetryFailed, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

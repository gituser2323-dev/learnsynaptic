import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns/[id]/schedule
 *
 * Schedule Campaign (CAMPAIGN_ARCHITECTURE.md §4, §7). Body:
 * `{ scheduledFor: string }` (ISO timestamp, must be in the future).
 * Enqueues a single "promote scheduled campaign" job on the shared
 * scheduler for that time — when it fires, per-message send jobs are
 * created and the campaign moves to "sending". Requires the campaign to
 * be "ready".
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleScheduleCampaign(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = await parseJsonBody(request);
  const scheduledFor = typeof (body as Record<string, unknown>)?.scheduledFor === "string"
    ? (body as Record<string, unknown>).scheduledFor as string
    : "";

  if (!scheduledFor) {
    throw new ValidationApiError([{ field: "scheduledFor", message: "scheduledFor is required." }]);
  }

  const result = await whatsappCampaignService.scheduleCampaign(id, scheduledFor, {
    requestId: ctx.requestId,
    actorId: ctx.authContext.userId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ campaign: result.campaign });
}

export const POST = withApiRoute("whatsapp_campaigns.schedule", handleScheduleCampaign, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

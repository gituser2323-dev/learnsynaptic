import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns/[id]/archive
 *
 * WhatsApp Platform (Phase 2), Module 2.5 — hides a campaign from the
 * default Campaign History list. No status restriction, unlike cancel:
 * archiving isn't a destructive action on its own.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleArchiveCampaign(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const result = await whatsappCampaignService.archiveCampaign(id, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ campaign: result.campaign });
}

export const POST = withApiRoute("whatsapp_campaigns.archive", handleArchiveCampaign, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns/[id]/clone
 *
 * WhatsApp Platform (Phase 2), Module 2.5 — creates a brand-new draft
 * from an existing campaign's name/template/recurrence rule. See
 * whatsappCampaignService.cloneCampaign's own doc comment for why this
 * satisfies the module's Definition of Done ("cloning a completed
 * campaign produces a clean draft with zero carried-over Message
 * rows") by construction, not by extra guard logic here.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleCloneCampaign(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const result = await whatsappCampaignService.cloneCampaign(id, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ campaign: result.campaign }, 201);
}

export const POST = withApiRoute("whatsapp_campaigns.clone", handleCloneCampaign, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

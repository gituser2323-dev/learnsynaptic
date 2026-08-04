import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns/[id]/unarchive
 *
 * WhatsApp Platform (Phase 2), Module 2.5 — reverses archive. Not
 * separately audited (see auditLog's own "genuine deliberate state
 * change" bar) — restoring visibility of something is lower business
 * value than the archive decision itself.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleUnarchiveCampaign(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const result = await whatsappCampaignService.unarchiveCampaign(id);

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ campaign: result.campaign });
}

export const POST = withApiRoute("whatsapp_campaigns.unarchive", handleUnarchiveCampaign, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

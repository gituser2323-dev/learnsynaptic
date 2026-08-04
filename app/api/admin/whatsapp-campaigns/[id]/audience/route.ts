import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";
import type { ResolveAudienceInput } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns/[id]/audience
 *
 * Audience Selection / Contact Segmentation (CAMPAIGN_ARCHITECTURE.md
 * §5) for the "filter" and "manual" sources — CSV import has its own
 * route (.../import, multipart) since it's a file upload, not JSON.
 *
 * Body:
 *   { source: "filter", leadFilters: LeadListFilters }
 *   { source: "manual", recipients: { phoneE164: string; name?: string }[] }
 *
 * Resolving an audience snapshots it into Message rows immediately —
 * never re-queried live at send time (§5's resolution rule) — and
 * moves the campaign from "draft" to "ready".
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleResolveAudience(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = await parseJsonBody(request);

  if (typeof body !== "object" || body === null || typeof (body as Record<string, unknown>).source !== "string") {
    throw new ValidationApiError([{ field: "source", message: "source must be \"filter\" or \"manual\"." }]);
  }

  const input = body as ResolveAudienceInput;
  const result = await whatsappCampaignService.resolveAudience(id, input);

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ campaign: result.campaign, resolution: result.data });
}

export const POST = withApiRoute("whatsapp_campaigns.resolve_audience", handleResolveAudience, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

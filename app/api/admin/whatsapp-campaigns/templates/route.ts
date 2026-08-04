import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, parsePaginationParams, ValidationApiError } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns/templates, GET .../templates
 *
 * CampaignTemplate — a thin, reusable reference to a Meta-approved
 * template (CAMPAIGN_ARCHITECTURE.md §3). Does not duplicate
 * WhatsAppTemplatePayload or change how a send actually happens.
 *
 * ⚠️ requiredRole: "admin" — same fail-closed scoping as every route in
 * the Admin Dashboard Backend module.
 */
async function handleCreateTemplate(request: Request): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  const result = await whatsappCampaignService.createTemplate(body);

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ template: result.template }, 201);
}

async function handleListTemplates(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const result = await whatsappCampaignService.listTemplates(
    { search: searchParams.get("search") || undefined },
    page,
    limit,
  );
  return apiSuccess({ ...result });
}

export const POST = withApiRoute("whatsapp_campaigns.templates.create", handleCreateTemplate, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

export const GET = withApiRoute("whatsapp_campaigns.templates.list", handleListTemplates, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

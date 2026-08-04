import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * POST /api/admin/whatsapp-campaigns/[id]/import
 *
 * CSV Import (CAMPAIGN_ARCHITECTURE.md §6, approved decisions 1 and 2:
 * Papa Parse, capped at 5,000 rows via config/whatsappCampaigns.ts).
 * The one route in this codebase that isn't JSON — `multipart/form-data`
 * with a `file` field, since every other route uses parseJsonBody().
 *
 * Rejected rows (invalid/duplicate/missing phone numbers) are returned
 * in the response, not silently dropped — see csvImportService.ts.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleImportCsv(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new ValidationApiError([{ field: "root", message: "Request body must be multipart/form-data." }]);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new ValidationApiError([{ field: "file", message: 'A CSV file is required (form field name: "file").' }]);
  }

  const csvText = await file.text();
  const result = await whatsappCampaignService.resolveAudienceFromCsv(id, csvText);

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ campaign: result.campaign, importResult: result.result });
}

export const POST = withApiRoute("whatsapp_campaigns.import_csv", handleImportCsv, {
  requiredRole: "admin",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

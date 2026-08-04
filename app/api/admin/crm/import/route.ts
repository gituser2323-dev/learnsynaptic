import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { leadService } from "@/lib/services/leads";

/**
 * POST /api/admin/crm/import?mode=preview|commit
 *
 * Enterprise CRM (Phase 1) — general Lead CSV import. Same
 * `multipart/form-data` shape as the existing WhatsApp campaign CSV
 * import (app/api/admin/whatsapp-campaigns/[id]/import) — the one other
 * non-JSON route in this codebase, matched deliberately rather than
 * inventing a second convention.
 *
 * `mode=preview` (default) parses and validates without writing
 * anything — the "Preview Before Import" requirement; the UI shows the
 * result and only re-submits with `mode=commit` once the user confirms.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, RBAC (Admin/Manager/Counsellor).
 */
async function handleImport(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "commit" ? "commit" : "preview";

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

  if (mode === "preview") {
    const preview = leadService.previewImport(csvText);
    if (!preview.success) {
      throw new ValidationApiError([{ field: "file", message: preview.error }]);
    }
    return apiSuccess({ mode, ...preview });
  }

  const result = await leadService.importLeadsFromCsv(csvText, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ mode, ...result });
}

// RC-4 — Serverless Limits: `mode=commit` calls registerLead() once per
// CSV row, sequentially (validation + dedup + scoring + assignment per
// row, not a bulk insert — see leadService.importLeadsFromCsv's own doc
// comment), up to CAMPAIGN_CSV_IMPORT_MAX_ROWS rows. An explicit ceiling
// here is honest about that real cost rather than relying on whatever a
// given Vercel plan's own default happens to be. Disclosed, not further
// hardened this pass: converting this into an async, progress-polling
// background job (matching RC-3's own job architecture) would be a real
// UX change to an existing, working feature — a reasonable next step if
// CAMPAIGN_CSV_IMPORT_MAX_ROWS is ever raised significantly, not
// required at today's 5,000-row cap.
export const maxDuration = 60;

export const POST = withApiRoute("admin.crm.import", handleImport, {
  requiredRole: "manager",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

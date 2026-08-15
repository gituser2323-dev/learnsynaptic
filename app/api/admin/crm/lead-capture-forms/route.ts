import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { leadCaptureFormService } from "@/lib/services/crm/leadCaptureForms";

/**
 * GET /api/admin/crm/lead-capture-forms, POST /api/admin/crm/lead-capture-forms
 *
 * Lead Capture — admin CRUD for the tenant-facing public forms (the
 * "PUBLIC LEAD CAPTURE" entry point). Mirrors the Tags catalog's own
 * route shape (app/api/admin/crm/tags/route.ts) exactly.
 *
 * ⚠️ RBAC: GET is "counsellor" — read-only, needed to see which forms
 * exist; POST (creating a new public form) is "manager" — CRM
 * configuration, the same tier tag/custom-field/pipeline creation uses.
 */
async function handleListForms(): Promise<NextResponse> {
  const forms = await leadCaptureFormService.listForms();
  return apiSuccess({ forms });
}

async function handleCreateForm(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  const result = await leadCaptureFormService.createForm(body, { requestId: ctx.requestId, actorId: ctx.authContext.userId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ form: result.form }, 201);
}

export const GET = withApiRoute("admin.crm.leadCaptureForms.list", handleListForms, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.crm.leadCaptureForms.create", handleCreateForm, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

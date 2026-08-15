import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { leadCaptureFormService } from "@/lib/services/crm/leadCaptureForms";

/**
 * PATCH /api/admin/crm/lead-capture-forms/[id], DELETE /api/admin/crm/lead-capture-forms/[id]
 *
 * Lead Capture — generic edit (name/active/fields/successMessage) and
 * delete for one form. PATCH mirrors the Tasks route's own generic-edit
 * shape (app/api/admin/crm/tasks/[id]/route.ts); DELETE mirrors Tags'.
 * Deleting a form does NOT touch any Lead already created through it —
 * same "stale reference just stops resolving" posture Tag deletion
 * already established for Lead.tags, not a cascading write.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, same tier
 * every other CRM-catalog mutation in this app already uses.
 */
async function handleUpdateForm(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const existing = await leadCaptureFormService.getForm(id);
  if (!existing) throw new NotFoundApiError("LeadCaptureForm", id);

  const body = await parseJsonBody(request);
  const result = await leadCaptureFormService.updateForm(id, body, { requestId: ctx.requestId, actorId: ctx.authContext.userId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ form: result.form });
}

async function handleDeleteForm(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  await leadCaptureFormService.deleteForm(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  return apiSuccess({ deleted: true });
}

export const PATCH = withApiRoute("admin.crm.leadCaptureForms.update", handleUpdateForm, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

export const DELETE = withApiRoute("admin.crm.leadCaptureForms.delete", handleDeleteForm, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

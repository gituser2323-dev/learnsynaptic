import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { customFieldService } from "@/lib/services/crm/customFields";

/**
 * GET /api/admin/crm/custom-fields, POST /api/admin/crm/custom-fields
 *
 * Enterprise CRM (Phase 1) — Custom Field definitions (text, number,
 * date, dropdown, checkbox, radio, multiselect). Every Lead's
 * customFields value is validated against the live definition set
 * returned here — see lib/services/crm/customFields/validation.ts.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, RBAC (Admin/Manager/Counsellor).
 */
async function handleListDefinitions(): Promise<NextResponse> {
  const definitions = await customFieldService.listDefinitions();
  return apiSuccess({ definitions });
}

async function handleCreateDefinition(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  const result = await customFieldService.createDefinition(body, {
    requestId: ctx.requestId,
    actorId: ctx.authContext.userId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ definition: result.definition }, 201);
}

export const GET = withApiRoute("admin.crm.custom_fields.list", handleListDefinitions, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.crm.custom_fields.create", handleCreateDefinition, {
  requiredRole: "manager",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

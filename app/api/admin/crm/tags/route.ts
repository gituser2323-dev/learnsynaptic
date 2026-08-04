import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { tagService } from "@/lib/services/crm/tags";

/**
 * GET /api/admin/crm/tags, POST /api/admin/crm/tags
 *
 * Enterprise CRM (Phase 1) — Lead Tags catalog.
 *
 * ⚠️ RBAC: GET is "counsellor" — reading the tag catalog is needed just
 * to render tag chips on a lead a counsellor is allowed to see; POST
 * (defining the catalog) is "manager" — CRM configuration.
 */
async function handleListTags(): Promise<NextResponse> {
  const tags = await tagService.listTags();
  return apiSuccess({ tags });
}

async function handleCreateTag(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  const result = await tagService.createTag(body, { requestId: ctx.requestId, actorId: ctx.authContext.userId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ tag: result.tag }, 201);
}

export const GET = withApiRoute("admin.crm.tags.list", handleListTags, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.crm.tags.create", handleCreateTag, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { leadService } from "@/lib/services/leads";

/**
 * PUT /api/admin/leads/[id]/tags
 *
 * Enterprise CRM (Phase 1) — replaces this Lead's full tag set (an
 * "untag" is just calling this again without that tag id). Bulk
 * add-a-tag-across-many-leads is the separate, additive
 * POST /api/admin/leads/bulk (action: "tag") — this route is the
 * single-lead, single-source-of-truth replace path.
 *
 * ⚠️ RBAC: "counsellor" tier, but only on a lead assigned to them —
 * tagging is part of "update assigned leads."
 */
async function handleSetTags(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const existing = await leadService.getLead(id);
  if (!existing) throw new NotFoundApiError("Lead", id);
  if (ctx.authContext.role === "counsellor" && existing.assignedCounsellorId !== ctx.authContext.userId) {
    throw new ForbiddenApiError("You can only tag leads assigned to you.");
  }

  const body = (await parseJsonBody(request)) as { tagIds?: unknown };
  if (!Array.isArray(body.tagIds)) {
    throw new ValidationApiError([{ field: "tagIds", message: "tagIds must be an array of tag ids." }]);
  }

  const lead = await leadService.tagLead(id, body.tagIds as string[], {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ lead });
}

export const PUT = withApiRoute("admin.leads.set_tags", handleSetTags, {
  requiredRole: "counsellor",
  rateLimit: { limit: 40, windowMs: 60_000 },
});

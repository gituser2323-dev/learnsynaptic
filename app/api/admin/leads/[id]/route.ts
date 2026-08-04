import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { leadService } from "@/lib/services/leads";

/**
 * GET /api/admin/leads/[id], PATCH /api/admin/leads/[id]
 *
 * Enterprise CRM (Phase 1) — the Lead detail page's data source (GET)
 * and generic edit path (PATCH: name/email/phone/program/message/
 * status/tags/customFields/archived — everything the detail page's
 * inline edit controls touch). Tagging/assignment/scoring have their
 * own more specific routes/services layered on top of the same
 * underlying Lead record — this route is the plain field-edit path.
 *
 * ⚠️ RBAC: "counsellor" tier, but only on a lead assigned to them —
 * "View assigned leads" / "Update assigned leads." `assignedCounsellorId`
 * itself is stripped from the PATCH body regardless of role — reassignment
 * is a Manager-tier action with its own route/audit entry, never a side
 * effect of a plain field edit.
 */
function assertCounsellorOwnsLead(ctx: ApiRouteContext, lead: { assignedCounsellorId?: string }): void {
  if (ctx.authContext.role === "counsellor" && lead.assignedCounsellorId !== ctx.authContext.userId) {
    throw new ForbiddenApiError("You can only access leads assigned to you.");
  }
}

async function handleGetLead(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const lead = await leadService.getLead(id);
  if (!lead) throw new NotFoundApiError("Lead", id);
  assertCounsellorOwnsLead(ctx, lead);
  return apiSuccess({ lead });
}

async function handleUpdateLead(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const existing = await leadService.getLead(id);
  if (!existing) throw new NotFoundApiError("Lead", id);
  assertCounsellorOwnsLead(ctx, existing);

  const body = (await parseJsonBody(request)) as Record<string, unknown>;
  delete body.assignedCounsellorId;
  const result = await leadService.updateLead(id, body as never, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ lead: result.lead });
}

export const GET = withApiRoute("admin.leads.get", handleGetLead, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const PATCH = withApiRoute("admin.leads.update", handleUpdateLead, {
  requiredRole: "counsellor",
  rateLimit: { limit: 40, windowMs: 60_000 },
});

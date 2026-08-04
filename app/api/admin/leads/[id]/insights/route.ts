import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams, NotFoundApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { leadService } from "@/lib/services/leads";
import { leadInsightService } from "@/lib/services/crm/leadInsights";

/**
 * GET /api/admin/leads/[id]/insights, POST /api/admin/leads/[id]/insights
 *
 * AI CRM (Phase 5), Module 5.1 — GET returns this lead's insight
 * history (newest first); POST is the manual "Analyze Again" trigger.
 * Both always return 200 with a real LeadInsight row even when AI is
 * unavailable or the vendor call failed (status: "unavailable"/"error")
 * — the graceful-degradation contract lives in leadInsightService, not
 * here; this route never turns "no AI provider configured" into an
 * error response.
 *
 * ⚠️ RBAC: "counsellor" tier, but only on a lead assigned to them — the
 * same ownership gate every other lead-scoped route in this directory
 * duplicates rather than shares (see app/api/admin/leads/[id]/route.ts's
 * own comment on this).
 */
async function assertAccess(ctx: ApiRouteContext, id: string): Promise<void> {
  const lead = await leadService.getLead(id);
  if (!lead) throw new NotFoundApiError("Lead", id);
  if (ctx.authContext.role === "counsellor" && lead.assignedCounsellorId !== ctx.authContext.userId) {
    throw new ForbiddenApiError("You can only view AI insights for leads assigned to you.");
  }
}

async function handleListInsights(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  await assertAccess(ctx, id);

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const result = await leadInsightService.listInsights(id, page, limit);
  return apiSuccess({ ...result });
}

async function handleAnalyzeLead(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  await assertAccess(ctx, id);

  const insight = await leadInsightService.analyzeLead(id, {
    trigger: "manual",
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ insight }, 201);
}

export const GET = withApiRoute("admin.leads.insights.list", handleListInsights, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.leads.insights.analyze", handleAnalyzeLead, {
  requiredRole: "counsellor",
  // AI vendor calls are slow (network round-trip to a real model) and
  // costed per-call — a tighter rate limit than the plain-CRUD routes
  // above, the same posture WhatsApp campaign sends take.
  rateLimit: { limit: 10, windowMs: 60_000 },
});

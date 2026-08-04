import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { getExecutiveDashboard } from "@/lib/services/executiveDashboard";
import { resolveDateRangeFromParams } from "@/lib/services/revenueAnalytics/dateRanges";

/**
 * GET /api/admin/executive/dashboard
 *
 * Enterprise Analytics (Phase 7), module 7.3 — Executive Dashboard's
 * KPI Layer, Revenue Overview, Sales Funnel, Counsellor Performance,
 * Campaign Performance, WhatsApp Health, Automation Health, and
 * Payment Health, composed in one payload — the same "a dashboard
 * fetches all of these together" precedent
 * /api/admin/analytics/revenue (Module 7.2) already established. The
 * Action Center section has its own route
 * (/api/admin/executive/action-center) and its own fetch on the client,
 * kept separate rather than folded in here: it answers a different
 * question ("what needs my attention right now," items+hrefs) than
 * this route's metrics/charts, and the two sections already render
 * independently on the page.
 *
 * ⚠️ requiredRole: "admin" — matches /api/admin/analytics/revenue's own
 * gate for the identical reason: this payload aggregates account-wide
 * revenue, payment, and workflow figures, not a single record a
 * manager might legitimately need. Per the mission's own §15, this is
 * the same RBAC tier already applied throughout Phase 7.
 *
 * Organization isolation (mission §11): every underlying service reads
 * through the same repositories every other module already uses —
 * organizationId remains disclosed, schema-level scaffolding,
 * unpopulated everywhere in this app (Modules 6.1–6.5, 7.2's own
 * precedent). This route does not implement Phase 8 tenant isolation
 * (mission's own explicit "do NOT implement full Phase 8 tenant
 * isolation here").
 */
async function handleGetExecutiveDashboard(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const range = resolveDateRangeFromParams(searchParams);
  const result = await getExecutiveDashboard(range);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.executive.dashboard.get", handleGetExecutiveDashboard, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

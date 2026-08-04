import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { getActionCenter } from "@/lib/services/executiveDashboard";
import { resolveDateRangeFromParams } from "@/lib/services/revenueAnalytics/dateRanges";

/**
 * GET /api/admin/executive/action-center
 *
 * Enterprise Analytics (Phase 7), module 7.3 — Executive Dashboard's
 * "Needs Attention" area (mission's own Action Center section). A thin
 * composition over eight already-existing list/read operations (see
 * lib/services/executiveDashboard's own module doc) — not a second
 * notification engine.
 *
 * ⚠️ requiredRole: "admin" — matches /api/admin/analytics/revenue's own
 * gate: this payload surfaces failed payments, integration health, and
 * webhook failure detail alongside everything else, the same
 * operational/security visibility tier Settings' own Webhook
 * Deliveries and Environment Configuration already require.
 */
async function handleGetActionCenter(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const range = resolveDateRangeFromParams(searchParams);
  const result = await getActionCenter(range);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.executive.actionCenter.get", handleGetActionCenter, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

import { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { getAutomationAnalytics, getWorkflowPerformance } from "@/lib/services/automation/analytics";
import {
  getRevenueMetrics,
  getRevenueGrowth,
  getRevenueAttribution,
  getCrmRevenueFunnel,
  getCounsellorRevenueStats,
  getCampaignRoi,
  getWhatsAppRevenue,
  getAutomationRoi,
} from "@/lib/services/revenueAnalytics";
import { resolveDateRangeFromParams } from "@/lib/services/revenueAnalytics/dateRanges";
import { buildRevenueAnalyticsCsv, type RevenueAnalyticsCsvSection } from "./csv";

const CSV_SECTIONS: RevenueAnalyticsCsvSection[] = ["workflows", "attribution", "campaigns", "whatsapp", "counsellors"];

/**
 * GET /api/admin/analytics/revenue
 *
 * Enterprise Analytics (Phase 7), module 7.2 — Automation & Revenue
 * Analytics: every new analytics surface this module adds, composed
 * into one payload keyed by section (the same "a dashboard fetches all
 * of these together" reasoning /api/admin/marketing and
 * /api/admin/analytics already document for their own composition).
 *
 * ⚠️ requiredRole: "admin" — matches /api/admin/marketing's own gate
 * for the identical reason: this payload aggregates account-wide
 * revenue, not a single record a manager might legitimately need for
 * one lead/payment. See mission §15 / the Implementation Audit's
 * Security section for the full RBAC rationale.
 *
 * Organization isolation (mission §11): every underlying service reads
 * through the same repositories every other module already uses, none
 * of which enforce real cross-tenant scoping today — organizationId is
 * schema-level scaffolding, unpopulated everywhere in this app (see
 * lib/services/organizations/types.ts), the same disclosed, consistent
 * state Modules 6.1–6.5 already carry forward. This route does not
 * pretend otherwise; it is exactly as tenant-isolated as the rest of
 * the application is today, no more and no less.
 */
/**
 * `?format=csv&section=workflows|attribution|campaigns|whatsapp|counsellors`
 * — mission §14. Only fetches the one section's own data, not the full
 * ten-call composition below, since an export is a deliberate one-off
 * action, not the dashboard's own steady-state load.
 */
async function handleCsvExport(section: RevenueAnalyticsCsvSection, request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const range = resolveDateRangeFromParams(searchParams);
  const csv = await buildRevenueAnalyticsCsv(section, range);
  return new NextResponse(csv, {
    status: 200,
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename=${section}.csv` },
  });
}

async function handleGetRevenueAnalytics(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const range = resolveDateRangeFromParams(searchParams);

  const formatParam = searchParams.get("format");
  const sectionParam = searchParams.get("section") as RevenueAnalyticsCsvSection | null;
  if (formatParam === "csv" && sectionParam && CSV_SECTIONS.includes(sectionParam)) {
    return handleCsvExport(sectionParam, request);
  }

  const [
    automation,
    workflowPerformance,
    automationRoi,
    revenue,
    revenueGrowth,
    attribution,
    funnel,
    counsellors,
    campaignRoi,
    whatsapp,
  ] = await Promise.all([
    getAutomationAnalytics(range),
    getWorkflowPerformance(range),
    getAutomationRoi(range),
    getRevenueMetrics(range),
    getRevenueGrowth(range),
    getRevenueAttribution(range),
    getCrmRevenueFunnel(range),
    getCounsellorRevenueStats(range),
    getCampaignRoi(range),
    getWhatsAppRevenue(range),
  ]);

  return apiSuccess({
    range,
    automation,
    workflowPerformance,
    automationRoi,
    revenue,
    revenueGrowth,
    attribution,
    funnel,
    counsellors,
    campaignRoi,
    whatsapp,
  });
}

export const GET = withApiRoute("admin.analytics.revenue.get", handleGetRevenueAnalytics, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

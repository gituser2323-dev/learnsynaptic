import { leadService } from "@/lib/services/leads";
import { pipelineService } from "@/lib/services/crm/pipelines";
import { paymentService } from "@/lib/services/payments";
import {
  getRevenueMetrics,
  getRevenueGrowth,
  getRevenueTrend,
  getRevenueAttribution,
  getCrmRevenueFunnel,
  getCounsellorRevenueStats,
  getCampaignRoi,
  getWhatsAppRevenue,
} from "@/lib/services/revenueAnalytics";
import { getAutomationAnalytics, getWorkflowPerformance } from "@/lib/services/automation/analytics";
import type {
  DateRange,
  ExecutiveDashboardResult,
  ExecutiveKpis,
  ExecutivePaymentHealth,
  ExecutiveWhatsAppHealth,
} from "./types";
import type { WhatsAppCampaignRevenueEntry } from "@/lib/services/revenueAnalytics";

function pct(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : (numerator / denominator) * 100;
}

/** See ExecutiveWhatsAppHealth's own module doc: a pure sum over
 *  campaigns already fetched for Campaign Performance, never a second
 *  Message query. */
function summarizeWhatsAppHealth(campaigns: WhatsAppCampaignRevenueEntry[]): ExecutiveWhatsAppHealth {
  const totals = campaigns.reduce(
    (acc, c) => ({
      sentCount: acc.sentCount + c.sentCount,
      deliveredCount: acc.deliveredCount + c.deliveredCount,
      readCount: acc.readCount + c.readCount,
      failedCount: acc.failedCount + c.failedCount,
      replyCount: acc.replyCount + c.replyCount,
    }),
    { sentCount: 0, deliveredCount: 0, readCount: 0, failedCount: 0, replyCount: 0 },
  );

  return {
    ...totals,
    deliveryRatePct: pct(totals.deliveredCount, totals.sentCount),
    readRatePct: pct(totals.readCount, totals.deliveredCount),
    replyRatePct: pct(totals.replyCount, totals.deliveredCount),
  };
}

/** See ExecutivePaymentHealth's own module doc: a thin reshape of
 *  paymentService.getAnalytics() (Module 6.4), not a second query. */
function summarizePaymentHealth(analytics: Awaited<ReturnType<typeof paymentService.getAnalytics>>): ExecutivePaymentHealth {
  const succeededCount = analytics.byStatus.succeeded;
  const failedCount = analytics.byStatus.failed;
  return {
    succeededCount,
    failedCount,
    refundedCount: analytics.byStatus.refunded,
    partiallyRefundedCount: analytics.byStatus.partially_refunded,
    totalTransactions: analytics.totalTransactions,
    allTimeCollectedRevenueInr: analytics.succeededByCurrency.INR ?? 0,
    paymentSuccessRatePct: pct(succeededCount, succeededCount + failedCount),
  };
}

/**
 * Enterprise Analytics (Phase 7), module 7.3 — Executive Dashboard's
 * composed summary: KPI Layer + Revenue Overview + Sales Funnel +
 * Counsellor Performance + Campaign Performance + WhatsApp Health +
 * Automation Health + Payment Health. See ./types.ts's own module doc:
 * every field here either IS an existing 7.1/7.2 result verbatim, or a
 * pure aggregation over one already fetched for this same response —
 * this module never re-derives a number an existing service already
 * owns (mission's own explicit "COMPOSE existing analytics rather than
 * create a competing analytics system").
 */
export async function getExecutiveDashboard(range: DateRange): Promise<ExecutiveDashboardResult> {
  const [
    revenue,
    revenueGrowth,
    revenueTrend,
    funnel,
    attribution,
    counsellors,
    campaignRoi,
    whatsappCampaigns,
    automation,
    workflowPerformance,
    openOpportunities,
    wonOpportunities,
    lostOpportunities,
    hotLeadsPage,
    warmLeadsPage,
    paymentAnalytics,
  ] = await Promise.all([
    getRevenueMetrics(range),
    getRevenueGrowth(range),
    getRevenueTrend(range),
    getCrmRevenueFunnel(range),
    getRevenueAttribution(range),
    getCounsellorRevenueStats(range),
    getCampaignRoi(range),
    getWhatsAppRevenue(range),
    getAutomationAnalytics(range),
    getWorkflowPerformance(range),
    pipelineService.listOpportunities({ status: "open" }),
    pipelineService.listOpportunities({ status: "won" }),
    pipelineService.listOpportunities({ status: "lost" }),
    leadService.listLeads({ health: "hot" }, 1, 1),
    leadService.listLeads({ health: "warm" }, 1, 1),
    paymentService.getAnalytics(),
  ]);

  const whatsapp = summarizeWhatsAppHealth(whatsappCampaigns.campaigns);
  const payments = summarizePaymentHealth(paymentAnalytics);

  const leadsCreatedStage = funnel.stages.find((s) => s.key === "leadsCreated");
  const registrationsConfirmedStage = funnel.stages.find((s) => s.key === "registrationsConfirmed");

  const kpis: ExecutiveKpis = {
    range,
    totalLeadsInRange: leadsCreatedStage?.count ?? 0,
    qualifiedLeadsCount: hotLeadsPage.total + warmLeadsPage.total,
    conversionsInRange: registrationsConfirmedStage?.count ?? 0,
    conversionRatePct: registrationsConfirmedStage?.conversionFromFirstPct ?? null,
    collectedRevenueInr: revenue.collectedRevenueInr,
    expectedRevenueInr: revenue.expectedRevenueInr,
    pipelineValueInr: revenue.pipelineValueInr,
    avgDealValueInr: revenue.avgDealValueInr,
    paymentSuccessRatePct: revenue.paymentSuccessRatePct,
    openOpportunitiesCount: openOpportunities.length,
    wonOpportunitiesCount: wonOpportunities.length,
    lostOpportunitiesCount: lostOpportunities.length,
    activeWorkflowDefinitions: automation.activeWorkflowDefinitions,
    automationSuccessRatePct: automation.successRatePct,
    whatsappDeliveryRatePct: whatsapp.deliveryRatePct,
    whatsappReadRatePct: whatsapp.readRatePct,
    whatsappReplyRatePct: whatsapp.replyRatePct,
  };

  return {
    range,
    kpis,
    revenue,
    revenueGrowth,
    revenueTrend,
    funnel,
    attribution,
    counsellors,
    campaignRoi,
    whatsapp,
    whatsappCampaigns,
    automation,
    workflowPerformance,
    payments,
  };
}

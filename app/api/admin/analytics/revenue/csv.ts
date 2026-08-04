import { toCsv } from "@/lib/api";
import { getWorkflowPerformance } from "@/lib/services/automation/analytics";
import { getRevenueAttribution, getCampaignRoi, getWhatsAppRevenue, getCounsellorRevenueStats } from "@/lib/services/revenueAnalytics";
import type { DateRange } from "@/lib/services/revenueAnalytics";

export type RevenueAnalyticsCsvSection = "workflows" | "attribution" | "campaigns" | "whatsapp" | "counsellors";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — CSV Export (mission
 * §14). One small serializer per already-tabular section, reusing
 * lib/api/csv.ts's own toCsv() — the same helper leads/campaigns/
 * registrations/attendance exports already use, not a new reporting
 * engine.
 */
export async function buildRevenueAnalyticsCsv(section: RevenueAnalyticsCsvSection, range: DateRange): Promise<string> {
  switch (section) {
    case "workflows": {
      const { workflows } = await getWorkflowPerformance(range);
      return toCsv(workflows, [
        { header: "workflowId", value: (w) => w.workflowId },
        { header: "workflowName", value: (w) => w.workflowName },
        { header: "active", value: (w) => w.active },
        { header: "triggerEventType", value: (w) => w.triggerEventType },
        { header: "runs", value: (w) => w.runs },
        { header: "successes", value: (w) => w.successes },
        { header: "failures", value: (w) => w.failures },
        { header: "conversions", value: (w) => w.conversions },
        { header: "entitiesAffected", value: (w) => w.entitiesAffected },
        { header: "messagesSent", value: (w) => w.messagesSent },
        { header: "tasksCreated", value: (w) => w.tasksCreated },
        { header: "revenueInfluencedInr", value: (w) => w.revenueInfluencedInr },
        { header: "revenueAttributedInr", value: (w) => w.revenueAttributedInr },
        { header: "avgCompletionTimeHours", value: (w) => w.avgCompletionTimeHours },
        { header: "lastExecutionAt", value: (w) => w.lastExecutionAt },
        { header: "errorRatePct", value: (w) => w.errorRatePct },
      ]);
    }
    case "attribution": {
      const { dimensions } = await getRevenueAttribution(range);
      const rows = dimensions.flatMap((d) => d.rows.map((r) => ({ dimension: d.dimension, type: d.type, ...r })));
      return toCsv(rows, [
        { header: "dimension", value: (r) => r.dimension },
        { header: "type", value: (r) => r.type },
        { header: "key", value: (r) => r.key },
        { header: "label", value: (r) => r.label },
        { header: "revenueInr", value: (r) => r.revenueInr },
        { header: "paymentCount", value: (r) => r.paymentCount },
      ]);
    }
    case "campaigns": {
      const { campaigns } = await getCampaignRoi(range);
      return toCsv(campaigns, [
        { header: "campaignId", value: (c) => c.campaignId },
        { header: "campaignName", value: (c) => c.campaignName },
        { header: "spendInr", value: (c) => c.spendInr },
        { header: "spendSource", value: (c) => c.spendSource },
        { header: "leads", value: (c) => c.leads },
        { header: "registrationsInRange", value: (c) => c.registrationsInRange },
        { header: "conversions", value: (c) => c.conversions },
        { header: "revenueInr", value: (c) => c.revenueInr },
        { header: "cpl", value: (c) => c.cpl },
        { header: "cpa", value: (c) => c.cpa },
        { header: "roas", value: (c) => c.roas },
        { header: "roiPct", value: (c) => c.roiPct },
      ]);
    }
    case "whatsapp": {
      const { campaigns } = await getWhatsAppRevenue(range);
      return toCsv(campaigns, [
        { header: "campaignId", value: (c) => c.campaignId },
        { header: "campaignName", value: (c) => c.campaignName },
        { header: "sentCount", value: (c) => c.sentCount },
        { header: "deliveredCount", value: (c) => c.deliveredCount },
        { header: "readCount", value: (c) => c.readCount },
        { header: "failedCount", value: (c) => c.failedCount },
        { header: "replyCount", value: (c) => c.replyCount },
        { header: "deliveryRatePct", value: (c) => c.deliveryRatePct },
        { header: "readRatePct", value: (c) => c.readRatePct },
        { header: "replyRatePct", value: (c) => c.replyRatePct },
        { header: "revenueInr", value: (c) => c.revenueInr },
        { header: "conversions", value: (c) => c.conversions },
        { header: "conversionRatePct", value: (c) => c.conversionRatePct },
      ]);
    }
    case "counsellors": {
      const { counsellors } = await getCounsellorRevenueStats(range);
      return toCsv(counsellors, [
        { header: "counsellorId", value: (c) => c.counsellorId },
        { header: "name", value: (c) => c.name },
        { header: "email", value: (c) => c.email },
        { header: "leadsAssignedCount", value: (c) => c.leadsAssignedCount },
        { header: "conversionRatePct", value: (c) => c.conversionRatePct },
        { header: "avgResponseTimeHours", value: (c) => c.avgResponseTimeHours },
        { header: "openOpportunitiesCount", value: (c) => c.openOpportunitiesCount },
        { header: "wonOpportunitiesCount", value: (c) => c.wonOpportunitiesCount },
        { header: "winRatePct", value: (c) => c.winRatePct },
        { header: "avgWonDealValueInr", value: (c) => c.avgWonDealValueInr },
        { header: "conversationsAssignedCount", value: (c) => c.conversationsAssignedCount },
        { header: "revenueInr", value: (c) => c.revenueInr },
        { header: "paidLeadsCount", value: (c) => c.paidLeadsCount },
      ]);
    }
  }
}

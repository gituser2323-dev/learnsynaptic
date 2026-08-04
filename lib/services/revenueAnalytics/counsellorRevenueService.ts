import { getPaymentRepository } from "@/lib/db";
import { leaderboardService } from "@/lib/services/crm/leaderboard";
import { pipelineAnalyticsService } from "@/lib/services/crm/pipelineAnalytics";
import { pipelineService } from "@/lib/services/crm/pipelines";
import type { Opportunity } from "@/lib/services/crm/pipelines";
import { conversationService } from "@/lib/services/conversations";
import { resolveCounsellorForPayments } from "./counsellorResolution";
import type { CounsellorRevenueResult, CounsellorRevenueStats } from "./counsellorRevenueTypes";
import type { DateRange } from "./types";

const MAX_PAYMENTS_FOR_ANALYTICS = 10_000;

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Counsellor + Revenue
 * (mission §6). See ./counsellorRevenueTypes.ts's own module doc: this
 * merges 1.6's Leaderboard and 7.1's Pipeline Analytics UNCHANGED, and
 * adds only revenueInr + conversationsAssignedCount, the two figures
 * neither existing module can compute.
 */
export async function getCounsellorRevenueStats(range: DateRange): Promise<CounsellorRevenueResult> {
  const [leaderboard, pipelineAnalytics, allOpportunities, paymentsPage] = await Promise.all([
    leaderboardService.getLeaderboard(),
    pipelineAnalyticsService.getPipelineAnalytics(),
    pipelineService.listOpportunities({}),
    (await getPaymentRepository()).list(
      { status: "succeeded", createdAfter: range.from, createdBefore: range.to },
      1,
      MAX_PAYMENTS_FOR_ANALYTICS,
    ),
  ]);

  const succeededInr = paymentsPage.items.filter((p) => p.currency === "INR");
  const opportunityById = new Map<string, Opportunity>(allOpportunities.map((o) => [o.id, o]));
  const counsellorByPaymentId = await resolveCounsellorForPayments(succeededInr, opportunityById);

  const revenueByCounsellor = new Map<string, number>();
  const paidLeadsByCounsellor = new Map<string, Set<string>>();
  for (const payment of succeededInr) {
    const counsellorId = counsellorByPaymentId.get(payment.id);
    if (!counsellorId) continue;
    revenueByCounsellor.set(counsellorId, (revenueByCounsellor.get(counsellorId) ?? 0) + payment.amountInSmallestUnit / 100);
    if (payment.leadId) {
      const set = paidLeadsByCounsellor.get(counsellorId) ?? new Set<string>();
      set.add(payment.leadId);
      paidLeadsByCounsellor.set(counsellorId, set);
    }
  }

  const pipelineByCounsellorId = new Map(pipelineAnalytics.counsellors.map((c) => [c.counsellorId, c]));

  const counsellors: CounsellorRevenueStats[] = await Promise.all(
    leaderboard.counsellors.map(async (l) => {
      const pipeline = pipelineByCounsellorId.get(l.counsellorId);
      const conversationsPage = await conversationService.listConversations({ assignedTo: l.counsellorId }, 1, 1);

      return {
        counsellorId: l.counsellorId,
        name: l.name,
        email: l.email,
        leadsAssignedCount: l.assignedLeadsCount,
        convertedLeadsCount: l.convertedLeadsCount,
        conversionRatePct: l.conversionRate,
        avgResponseTimeHours: l.avgResponseTimeHours,
        openTasksCount: l.openTasksCount,
        overdueTasksCount: l.overdueTasksCount,
        openOpportunitiesCount: pipeline?.openOpportunitiesCount ?? 0,
        wonOpportunitiesCount: pipeline?.wonOpportunitiesCount ?? 0,
        lostOpportunitiesCount: pipeline?.lostOpportunitiesCount ?? 0,
        winRatePct: pipeline?.winRate ?? null,
        openPipelineValueInr: pipeline?.openPipelineValueInr ?? null,
        avgWonDealValueInr: pipeline?.avgWonDealValueInr ?? null,
        conversationsAssignedCount: conversationsPage.total,
        revenueInr: revenueByCounsellor.get(l.counsellorId) ?? 0,
        paidLeadsCount: paidLeadsByCounsellor.get(l.counsellorId)?.size ?? 0,
      };
    }),
  );

  counsellors.sort((a, b) => b.revenueInr - a.revenueInr);

  return { range, counsellors };
}

import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Counsellor + Revenue
 * (mission §6): explicitly "reuse Module 7.1 analytics... do NOT
 * duplicate. Extend where required." Every field already computed by
 * an existing module is carried through UNCHANGED from that module's
 * own function — leadsAssigned/conversionRate/avgResponseTimeHours/
 * openTasksCount from 1.6's leaderboardService.getLeaderboard(),
 * openOpportunitiesCount/wonOpportunitiesCount/avgWonDealValueInr from
 * 7.1's pipelineAnalyticsService.getPipelineAnalytics(). Only
 * revenueInr and conversationsAssignedCount are genuinely new — neither
 * module could compute them (both predate Module 6.4 Payments; 1.6/7.1
 * are Lead/Task/Opportunity-derived, never Conversation-derived).
 */
export interface CounsellorRevenueStats {
  counsellorId: string;
  name: string;
  email: string;
  // From 1.6 (Leaderboard) — unchanged.
  leadsAssignedCount: number;
  convertedLeadsCount: number;
  conversionRatePct: number;
  avgResponseTimeHours: number | null;
  openTasksCount: number;
  overdueTasksCount: number;
  // From 7.1 (Pipeline Analytics) — unchanged.
  openOpportunitiesCount: number;
  wonOpportunitiesCount: number;
  lostOpportunitiesCount: number;
  winRatePct: number | null;
  openPipelineValueInr: number | null;
  avgWonDealValueInr: number | null;
  // New in 7.2.
  /** Currently assigned open+closed Conversations — an unscoped
   *  snapshot (current workload), the same convention 1.6's own
   *  openTasksCount already uses, not date-range filtered. */
  conversationsAssignedCount: number;
  /** Succeeded-payment revenue (INR) in `range`, attributed to this
   *  counsellor via the same Opportunity.ownerId-falling-back-to-Lead.
   *  assignedCounsellorId rule 7.1 already uses for ownership —
   *  correlation via that same join, not a guaranteed "this counsellor
   *  personally closed this sale" record. */
  revenueInr: number;
  paidLeadsCount: number;
}

export interface CounsellorRevenueResult {
  range: DateRange;
  counsellors: CounsellorRevenueStats[];
}

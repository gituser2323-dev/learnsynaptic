import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Automation ROI (mission
 * §9). Deliberately a thin reshape of
 * lib/services/automation/analytics/workflowPerformanceService.ts's own
 * output (mission §2), not a third recomputation of the same
 * lead/message/revenue joins — see automationRoiService.ts's own module
 * doc. The mission's own §9 vocabulary (leadsInfluenced,
 * revenueDirectInr, ...) is kept distinct from §2's
 * (entitiesAffected, revenueAttributedInr, ...) only because the
 * mission names both; the underlying numbers are identical per
 * workflow.
 */
export interface AutomationRoiEntry {
  workflowId: string;
  workflowName: string;
  executions: number;
  leadsInfluenced: number;
  /** completionReason === "converted" runs — see
   *  workflowPerformanceService's own doc on this signal. */
  conversionsInfluenced: number;
  messagesSent: number;
  /** Correlation: succeeded-payment revenue for leads this workflow
   *  ran against, regardless of why they paid. */
  revenueInfluencedInr: number;
  /** Stricter: revenue for leads whose workflow run was itself stopped
   *  by their own conversion event — see workflowPerformanceService's
   *  own DIRECT-but-inferred disclosure. Never presented as proven
   *  causation, only as the strictest signal this data supports. */
  revenueDirectInr: number;
}

export interface AutomationRoiSummary {
  range: DateRange;
  /** Plain per-workflow sums — NOT deduplicated account-wide. A lead
   *  simultaneously active in two workflows is counted once per
   *  workflow in leadsInfluenced/revenueInfluencedInr; a lead whose
   *  registration.created event stops two active runs at once (see
   *  triggers.ts) is counted once per workflow in
   *  conversionsInfluenced/revenueDirectInr too. Real per-workflow
   *  figures, not a fabricated account-wide total — use
   *  getAutomationAnalytics()'s own automationGeneratedConversions for
   *  the deduplicated, run-level (not workflow-summed) account-wide
   *  count. */
  totals: {
    executions: number;
    leadsInfluenced: number;
    conversionsInfluenced: number;
    messagesSent: number;
    revenueInfluencedInr: number;
    revenueDirectInr: number;
  };
  workflows: AutomationRoiEntry[];
}

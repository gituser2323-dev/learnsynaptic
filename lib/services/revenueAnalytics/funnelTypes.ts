import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — CRM Revenue Funnel
 * (mission §5): "Visitors/Leads → Qualified → Counselling → Opportunity
 * → Payment Pending → Paid → Enrolled" is the mission's own SUGGESTED
 * shape — this app's real LeadStatus enum
 * ("new"|"contacted"|"nurture"|"registered"|"closed") has no literal
 * "Qualified" or "Counselling" stage, and fabricating one would violate
 * this module's own "use the actual stages implemented" instruction.
 * The funnel below instead chains the REAL cross-entity events this
 * app's data model actually has, end to end:
 *
 *   Lead created → Opportunity created → Opportunity won →
 *   Payment succeeded → Registration confirmed ("Enrolled")
 *
 * Each stage's count is "how many entities reached this stage within
 * `range`" — independent per-stage counts, not a strict per-entity
 * cohort funnel (a lead created last month whose Opportunity was won
 * this month counts toward both stages in their own respective ranges)
 * — the same simpler, already-established convention
 * lib/services/marketing/funnels.ts's own Lead/Conversion/Revenue
 * funnels already use (compare leads-in-range against
 * registrations-in-range as independent counts, not a tracked cohort).
 */
export type CrmFunnelStageKey = "leadsCreated" | "opportunitiesCreated" | "opportunitiesWon" | "paymentsSucceeded" | "registrationsConfirmed";

export interface CrmFunnelStage {
  key: CrmFunnelStageKey;
  label: string;
  count: number;
  conversionFromPreviousPct: number | null;
  conversionFromFirstPct: number | null;
  dropOffFromPreviousPct: number | null;
  /** Null (not 0) where this stage carries no revenue concept of its
   *  own — see the module's own note on why Enrolled doesn't repeat
   *  Payment Succeeded's revenue. */
  revenueInr: number | null;
  /** Hours from the previous stage's own qualifying event to this
   *  stage's, averaged over entities that reached this stage in range
   *  AND whose previous-stage timestamp is resolvable via a real id
   *  join (see funnelService.ts for exactly which join each transition
   *  uses). Null for the first stage (no previous stage) or if no
   *  entity in range has a resolvable link. */
  avgTimeInStageHours: number | null;
}

export interface CrmFunnelResult {
  range: DateRange;
  stages: CrmFunnelStage[];
}

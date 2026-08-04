/** Counsellor & Pipeline Analytics domain layer — Enterprise Analytics
 *  (Phase 7), module 7.1. Distinct from module 1.6's Leaderboard: that
 *  module is entirely Lead/Task/Activity-derived (assignment, response
 *  time, task productivity); this module is Opportunity/Pipeline-derived
 *  (deal counts, win rate, stage funnels) and never recomputes anything
 *  the Leaderboard already owns. Not a persisted collection — every
 *  figure here is derived on read, the same "live aggregation" shape
 *  lib/services/marketing and lib/services/crm/leaderboard already use. */

export interface CounsellorStageBreakdownEntry {
  stageId: string;
  stageName: string;
  /** Currently-open opportunities sitting in this stage. */
  count: number;
}

export interface CounsellorPipelineStats {
  counsellorId: string;
  name: string;
  email: string;
  openOpportunitiesCount: number;
  wonOpportunitiesCount: number;
  lostOpportunitiesCount: number;
  /** 0–100. won / (won + lost) — null if this counsellor has no closed
   *  (won or lost) opportunities yet. */
  winRate: number | null;
  /** Sum of expectedRevenueInr across this counsellor's open
   *  opportunities — null if none of them disclose a value (not the
   *  same claim as "₹0 pipeline"). */
  openPipelineValueInr: number | null;
  /** Average expectedRevenueInr across won opportunities — null if none
   *  disclose a value. */
  avgWonDealValueInr: number | null;
  stageBreakdown: CounsellorStageBreakdownEntry[];
}

export interface StageFunnelEntry {
  stageId: string;
  stageName: string;
  order: number;
  /** Opportunities that have ever entered this stage, per
   *  Opportunity.stageHistory — not just ones currently sitting there. */
  enteredCount: number;
  /** 0–100, enteredCount relative to the pipeline's first stage — null
   *  if the first stage itself has zero entries. */
  conversionFromFirstStage: number | null;
  /** Average hours between entering this stage and leaving it, over
   *  opportunities that have actually completed that transition —
   *  deliberately excludes opportunities still sitting in the stage
   *  today (an in-progress stay isn't the same measurement as a
   *  completed one). Null if no opportunity has completed this
   *  transition yet — expected for any stage until stageHistory has
   *  had time to accumulate real transitions post-launch; see
   *  scripts/backfillOpportunityStageHistory.ts for the one-time seed
   *  given to pre-existing opportunities. */
  avgTimeInStageHours: number | null;
}

export interface PipelineFunnel {
  pipelineId: string;
  pipelineName: string;
  program?: string;
  stages: StageFunnelEntry[];
}

export interface PipelineAnalyticsResult {
  counsellors: CounsellorPipelineStats[];
  pipelines: PipelineFunnel[];
  generatedAt: string;
}

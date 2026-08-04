import { pipelineService } from "@/lib/services/crm/pipelines";

/**
 * Enterprise Analytics (Phase 7), module 7.1 — one-time backfill for
 * opportunities created before Opportunity.stageHistory existed. Seeds
 * each one with a single entry (current stageId, enteredAt: its own
 * updatedAt) so 7.1's stage-funnel "entered count" includes every
 * existing opportunity immediately, not just ones that move stage again
 * after this ships. This is an approximation, not real history — an
 * opportunity that has moved stage more than once before this backfill
 * only gets its *current* stage recorded, with the timestamp of its
 * *last* move, not every stage it actually passed through. Real,
 * multi-entry stage-duration data only starts accumulating from an
 * opportunity's next move onward.
 *
 * Idempotent — safe to re-run; pipelineService.backfillStageHistory()
 * only touches opportunities whose stageHistory is still empty, same
 * "safe to re-run" precedent as scripts/backfillLeadScores.ts and
 * scripts/backfillConversations.ts.
 *
 * Usage:
 *   npx tsx scripts/backfillOpportunityStageHistory.ts
 */
async function main(): Promise<void> {
  const { processed } = await pipelineService.backfillStageHistory();
  console.log(`Backfilled stageHistory for ${processed} opportunity(ies).`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});

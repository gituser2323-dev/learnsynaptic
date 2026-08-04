import { authService } from "@/lib/services/auth";
import { leadService } from "@/lib/services/leads";
import { pipelineService } from "@/lib/services/crm/pipelines";
import type { Opportunity, Pipeline } from "@/lib/services/crm/pipelines";
import type { PublicUser } from "@/lib/services/auth/types";
import type { CounsellorPipelineStats, PipelineAnalyticsResult, PipelineFunnel, StageFunnelEntry } from "./types";

function hoursBetween(earlier: string, later: string): number {
  return (new Date(later).getTime() - new Date(earlier).getTime()) / 3_600_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Opportunity.ownerId is the attribution source of truth; an
 *  opportunity without one (never explicitly assigned at the deal level)
 *  falls back to its parent Lead's assignedCounsellorId. Batches the
 *  Lead lookups by unique leadId rather than one-per-opportunity — the
 *  Kanban board already loads every opportunity in a pipeline at once,
 *  so a shared pipeline of leads is the common case, not the exception. */
async function resolveOwnerAttribution(opportunities: Opportunity[]): Promise<Map<string, string | undefined>> {
  const needsLeadLookup = opportunities.filter((o) => !o.ownerId);
  const uniqueLeadIds = [...new Set(needsLeadLookup.map((o) => o.leadId))];
  const leads = await Promise.all(uniqueLeadIds.map((leadId) => leadService.getLead(leadId)));
  const counsellorIdByLeadId = new Map(uniqueLeadIds.map((leadId, i) => [leadId, leads[i]?.assignedCounsellorId]));

  const attribution = new Map<string, string | undefined>();
  for (const opportunity of opportunities) {
    attribution.set(opportunity.id, opportunity.ownerId ?? counsellorIdByLeadId.get(opportunity.leadId));
  }
  return attribution;
}

async function buildCounsellorStats(
  staff: PublicUser[],
  pipelines: Pipeline[],
  opportunities: Opportunity[],
): Promise<CounsellorPipelineStats[]> {
  const attribution = await resolveOwnerAttribution(opportunities);
  const stageNameById = new Map<string, string>();
  for (const pipeline of pipelines) for (const stage of pipeline.stages) stageNameById.set(stage.id, stage.name);

  const stats: CounsellorPipelineStats[] = staff.map((user) => {
    const owned = opportunities.filter((o) => attribution.get(o.id) === user.id);
    const open = owned.filter((o) => o.status === "open");
    const won = owned.filter((o) => o.status === "won");
    const lost = owned.filter((o) => o.status === "lost");

    const openValues = open.map((o) => o.expectedRevenueInr).filter((v): v is number => v !== undefined);
    const wonValues = won.map((o) => o.expectedRevenueInr).filter((v): v is number => v !== undefined);

    const stageCounts = new Map<string, number>();
    for (const o of open) stageCounts.set(o.stageId, (stageCounts.get(o.stageId) ?? 0) + 1);

    return {
      counsellorId: user.id,
      name: user.name ?? user.email,
      email: user.email,
      openOpportunitiesCount: open.length,
      wonOpportunitiesCount: won.length,
      lostOpportunitiesCount: lost.length,
      winRate: won.length + lost.length === 0 ? null : (won.length / (won.length + lost.length)) * 100,
      openPipelineValueInr: openValues.length === 0 ? null : openValues.reduce((sum, v) => sum + v, 0),
      avgWonDealValueInr: average(wonValues),
      stageBreakdown: [...stageCounts.entries()].map(([stageId, count]) => ({
        stageId,
        stageName: stageNameById.get(stageId) ?? "Unknown stage",
        count,
      })),
    };
  });

  stats.sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1));
  return stats;
}

function buildPipelineFunnel(pipeline: Pipeline, opportunities: Opportunity[]): PipelineFunnel {
  const orderedStages = [...pipeline.stages].sort((a, b) => a.order - b.order);
  const firstStageId = orderedStages[0]?.id;

  const enteredBy = new Map<string, Set<string>>();
  const completedStayHours = new Map<string, number[]>();
  for (const stage of orderedStages) {
    enteredBy.set(stage.id, new Set());
    completedStayHours.set(stage.id, []);
  }

  for (const opportunity of opportunities) {
    const history = opportunity.stageHistory;
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const enteredSet = enteredBy.get(entry.stageId);
      if (!enteredSet) continue; // stage no longer on the pipeline; skip defensively
      enteredSet.add(opportunity.id);

      const next = history[i + 1];
      if (next) completedStayHours.get(entry.stageId)?.push(hoursBetween(entry.enteredAt, next.enteredAt));
    }
  }

  const firstStageEnteredCount = firstStageId ? (enteredBy.get(firstStageId)?.size ?? 0) : 0;

  const stages: StageFunnelEntry[] = orderedStages.map((stage) => {
    const enteredCount = enteredBy.get(stage.id)?.size ?? 0;
    return {
      stageId: stage.id,
      stageName: stage.name,
      order: stage.order,
      enteredCount,
      conversionFromFirstStage: firstStageEnteredCount === 0 ? null : (enteredCount / firstStageEnteredCount) * 100,
      avgTimeInStageHours: average(completedStayHours.get(stage.id) ?? []),
    };
  });

  return { pipelineId: pipeline.id, pipelineName: pipeline.name, program: pipeline.program, stages };
}

export const pipelineAnalyticsService = {
  /** Enterprise Analytics (Phase 7) — module 7.1's counsellor and
   *  pipeline-stage breakdowns. Reads every active staff member, every
   *  pipeline, and every opportunity once, then derives both views from
   *  the same in-memory set rather than querying per counsellor or per
   *  pipeline — cheaper than the Leaderboard's per-counsellor N+1 at
   *  this data volume, since Opportunity has no per-counsellor list
   *  endpoint worth calling repeatedly. */
  async getPipelineAnalytics(): Promise<PipelineAnalyticsResult> {
    const [staff, pipelines, opportunities] = await Promise.all([
      authService.listActiveStaff(),
      pipelineService.listPipelines(),
      pipelineService.listOpportunities({}),
    ]);

    const counsellors = await buildCounsellorStats(staff, pipelines, opportunities);
    const pipelineFunnels = pipelines.map((pipeline) =>
      buildPipelineFunnel(
        pipeline,
        opportunities.filter((o) => o.pipelineId === pipeline.id),
      ),
    );

    return { counsellors, pipelines: pipelineFunnels, generatedAt: new Date().toISOString() };
  },
};

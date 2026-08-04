import { getOpportunityRepository, getPipelineRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { activityService } from "@/lib/services/crm/activities";
import { publish } from "@/lib/events";
import type { AuditContext } from "@/lib/services/auditLog";
import type {
  CreateOpportunityInput,
  Opportunity,
  OpportunityListFilters,
  Pipeline,
  UpdateOpportunityInput,
} from "./types";

/** The default pipeline's stage set — exactly the 10 stages requested,
 *  in order. Seeded once, on first access, not at module load — a
 *  serverless cold start shouldn't write to the database just from
 *  being imported. */
const DEFAULT_STAGE_NAMES = [
  "Inquiry",
  "Interested",
  "Counselling",
  "Demo",
  "Payment Pending",
  "Paid",
  "Enrolled",
  "Completed",
  "Dropped",
  "Lost",
] as const;

export const pipelineService = {
  async ensureDefaultPipeline(): Promise<Pipeline> {
    const repository = await getPipelineRepository();
    const existing = await repository.getDefault();
    if (existing) return existing;

    return repository.create({
      name: "Default Pipeline",
      isDefault: true,
      stages: DEFAULT_STAGE_NAMES.map((name) => ({
        name,
        isWon: name === "Enrolled" || name === "Completed",
        isLost: name === "Dropped" || name === "Lost",
      })),
    });
  },

  async listPipelines(): Promise<Pipeline[]> {
    const repository = await getPipelineRepository();
    const pipelines = await repository.list();
    if (pipelines.length === 0) return [await this.ensureDefaultPipeline()];
    return pipelines;
  },

  /** Enterprise CRM (Phase 1) — "custom pipelines per program." A named
   *  pipeline is never `isDefault` from this path (only
   *  ensureDefaultPipeline() ever sets that, once, on first access) —
   *  every additional pipeline is strictly additive alongside it,
   *  preserving every existing caller that assumes exactly one pipeline
   *  exists (the Kanban board falls back to the first pipeline it gets
   *  back, same as before this method existed). */
  async createPipeline(
    input: { name: string; program?: string; stages: { name: string; isWon?: boolean; isLost?: boolean }[] },
    context: AuditContext = {},
  ): Promise<Pipeline> {
    const repository = await getPipelineRepository();
    const pipeline = await repository.create({
      name: input.name,
      program: input.program,
      isDefault: false,
      stages: input.stages,
    });
    await auditLogService.record({
      action: AUDIT_ACTIONS.PIPELINE_CREATED,
      entityType: "Pipeline",
      entityId: pipeline.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { name: pipeline.name, program: pipeline.program, stageCount: pipeline.stages.length },
    });
    return pipeline;
  },

  /** Refuses to delete the default pipeline (every pre-existing Opportunity
   *  and every caller that doesn't pass a pipelineId assumes it exists)
   *  or a pipeline that still has Opportunities on it (deleting those
   *  silently would be a bigger, different action than "delete a
   *  pipeline," and this module doesn't do silent cascades). */
  async deletePipeline(
    id: string,
    context: AuditContext = {},
  ): Promise<{ success: true } | { success: false; reason: string }> {
    const pipelineRepository = await getPipelineRepository();
    const pipeline = await pipelineRepository.findById(id);
    if (!pipeline) return { success: false, reason: "Pipeline not found." };
    if (pipeline.isDefault) return { success: false, reason: "The default pipeline cannot be deleted." };

    const opportunityRepository = await getOpportunityRepository();
    const opportunities = await opportunityRepository.list({ pipelineId: id });
    if (opportunities.length > 0) {
      return { success: false, reason: `${opportunities.length} opportunity(ies) still reference this pipeline.` };
    }

    await pipelineRepository.delete(id);
    await auditLogService.record({
      action: AUDIT_ACTIONS.PIPELINE_DELETED,
      entityType: "Pipeline",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { name: pipeline.name },
    });
    return { success: true };
  },

  async createOpportunity(input: CreateOpportunityInput, context: AuditContext = {}): Promise<Opportunity> {
    const repository = await getOpportunityRepository();
    const opportunity = await repository.create(input);
    await auditLogService.record({
      action: AUDIT_ACTIONS.OPPORTUNITY_CREATED,
      entityType: "Opportunity",
      entityId: opportunity.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { leadId: opportunity.leadId, pipelineId: opportunity.pipelineId },
    });
    await activityService.logSystemEvent("Lead", opportunity.leadId, "Opportunity created");
    return opportunity;
  },

  /** The Kanban board's drag-to-advance entry point. Resolves whether
   *  the target stage is a won/lost terminal stage from the Pipeline's
   *  own stage definitions — the caller (API route) never decides this
   *  itself, so "won" can't drift out of sync between the board's
   *  client-side rendering and what the server actually records. */
  async moveStage(
    opportunityId: string,
    newStageId: string,
    lostReason?: string,
    context: AuditContext = {},
  ): Promise<Opportunity> {
    const opportunityRepository = await getOpportunityRepository();
    const pipelineRepository = await getPipelineRepository();

    const existing = await opportunityRepository.findById(opportunityId);
    if (!existing) throw new Error(`Opportunity ${opportunityId} not found`);
    const pipeline = await pipelineRepository.findById(existing.pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${existing.pipelineId} not found`);

    const targetStage = pipeline.stages.find((s) => s.id === newStageId);
    if (!targetStage) throw new Error(`Stage ${newStageId} not found on pipeline ${pipeline.id}`);

    const update: UpdateOpportunityInput = { stageId: newStageId };
    if (targetStage.isWon) update.status = "won";
    else if (targetStage.isLost) {
      update.status = "lost";
      update.lostReason = lostReason;
    } else {
      update.status = "open";
    }

    const updated = await opportunityRepository.update(opportunityId, update);

    await auditLogService.record({
      action:
        update.status === "won"
          ? AUDIT_ACTIONS.OPPORTUNITY_WON
          : update.status === "lost"
            ? AUDIT_ACTIONS.OPPORTUNITY_LOST
            : AUDIT_ACTIONS.OPPORTUNITY_STAGE_CHANGED,
      entityType: "Opportunity",
      entityId: opportunityId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { stageId: newStageId, stageName: targetStage.name, lostReason },
    });
    await activityService.logSystemEvent("Lead", existing.leadId, `Opportunity moved to "${targetStage.name}"`);

    const eventType = update.status === "won" ? "opportunity.won" : update.status === "lost" ? "opportunity.lost" : "opportunity.stage_changed";
    await publish(eventType, {
      opportunityId,
      leadId: existing.leadId,
      stageId: newStageId,
      stageName: targetStage.name,
      status: update.status,
      lostReason: update.lostReason,
    });

    return updated;
  },

  async listOpportunities(filters: OpportunityListFilters): Promise<Opportunity[]> {
    const repository = await getOpportunityRepository();
    return repository.list(filters);
  },

  async updateOpportunity(id: string, input: UpdateOpportunityInput): Promise<Opportunity> {
    const repository = await getOpportunityRepository();
    return repository.update(id, input);
  },

  /** Enterprise Analytics (Phase 7), module 7.1 — one-time backfill for
   *  opportunities created before stageHistory existed. Seeds a single
   *  entry (current stageId, enteredAt: the opportunity's own
   *  updatedAt) so 7.1's stage-funnel counts include every existing
   *  opportunity from day one, not just ones that happen to move stage
   *  again after this ships — the same "seed one approximate entry from
   *  what's already on the record" shape as
   *  scripts/backfillConversations.ts, not a fabricated full history.
   *  Real, multi-entry stage duration only accumulates from here
   *  forward; see OpportunityStageHistoryEntry's own doc comment. */
  async backfillStageHistory(): Promise<{ processed: number }> {
    const repository = await getOpportunityRepository();
    const all = await repository.list({});
    const missing = all.filter((o) => o.stageHistory.length === 0);
    for (const opportunity of missing) {
      await repository.seedStageHistory(opportunity.id, {
        stageId: opportunity.stageId,
        enteredAt: opportunity.updatedAt,
      });
    }
    return { processed: missing.length };
  },
};

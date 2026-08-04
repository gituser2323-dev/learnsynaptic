import { getLeadInsightRepository, getActivityRepository, getConversationRepository, getMessageRepository, getOpportunityRepository } from "@/lib/db";
import { leadService } from "@/lib/services/leads";
import { scoringService } from "@/lib/services/crm/scoring";
import { AiProviderNotConfiguredError } from "@/lib/services/ai";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { PaginatedResult } from "@/lib/pagination";
import type { LeadInsight, LeadInsightTrigger } from "./types";

const RECENT_ACTIVITY_LIMIT = 10;
const RECENT_MESSAGE_LIMIT = 10;

export interface AnalyzeLeadOptions {
  trigger: LeadInsightTrigger;
  actorId?: string;
  requestId?: string;
}

/**
 * AI CRM (Phase 5), Module 5.1 — the one place that gathers Lead +
 * Activities + Conversation/Messages + Opportunities context and runs
 * it through the `ai` ScoringProvider. Deliberately NOT part of
 * scoringService.computeScore's own hot path (see that file's own doc
 * comment) — this is the on-demand ("Analyze Again") / automation-
 * triggered flow, called from nowhere else.
 */
export const leadInsightService = {
  async analyzeLead(leadId: string, options: AnalyzeLeadOptions): Promise<LeadInsight> {
    const repository = await getLeadInsightRepository();
    const lead = await leadService.getLead(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found.`);

    try {
      const [activityPage, conversationPage, opportunities] = await Promise.all([
        getActivityRepository().then((r) => r.listForEntity({ entityType: "Lead", entityId: leadId }, 1, RECENT_ACTIVITY_LIMIT)),
        getConversationRepository().then((r) => r.list({ leadId }, 1, 1)),
        getOpportunityRepository().then((r) => r.list({ leadId })),
      ]);

      const conversation = conversationPage.items[0];
      const recentMessages = conversation
        ? (await (await getMessageRepository()).list({ conversationId: conversation.id }, 1, RECENT_MESSAGE_LIMIT)).items
        : [];

      const result = await scoringService.computeScore(lead, "ai", {
        recentActivities: activityPage.items,
        recentMessages,
        opportunities,
      });

      const insight = await repository.create({
        leadId,
        status: "ok",
        score: result.score,
        health: result.health,
        summary: result.insight?.summary,
        buyingIntent: result.insight?.buyingIntent,
        strengths: result.insight?.strengths,
        risks: result.insight?.risks,
        nextAction: result.insight?.nextAction,
        confidence: result.insight?.confidence,
        reasoning: result.insight?.reasoning,
        providerId: result.insight?.providerId,
        trigger: options.trigger,
        actorId: options.actorId,
        organizationId: lead.organizationId,
      });

      if (options.trigger === "manual") {
        await auditLogService.record({
          action: AUDIT_ACTIONS.LEAD_AI_INSIGHT_ANALYZED,
          entityType: "Lead",
          entityId: leadId,
          actorId: options.actorId,
          requestId: options.requestId,
          metadata: { insightId: insight.id, providerId: result.insight?.providerId, score: result.score },
        });
      }

      return insight;
    } catch (error) {
      const unavailable = error instanceof AiProviderNotConfiguredError;
      return repository.create({
        leadId,
        status: unavailable ? "unavailable" : "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error during AI analysis.",
        trigger: options.trigger,
        actorId: options.actorId,
        organizationId: lead.organizationId,
      });
    }
  },

  async listInsights(leadId: string, page = 1, limit = 20): Promise<PaginatedResult<LeadInsight>> {
    const repository = await getLeadInsightRepository();
    return repository.list({ leadId }, page, limit);
  },

  async getLatestInsight(leadId: string): Promise<LeadInsight | null> {
    const repository = await getLeadInsightRepository();
    return repository.findLatest(leadId);
  },
};

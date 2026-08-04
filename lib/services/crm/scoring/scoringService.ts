import { getActivityRepository } from "@/lib/db";
import { getScoringProvider } from "./registry";
import type { Lead } from "@/lib/services/leads/types";
import type { LeadScoreInput, LeadScoreResult } from "./types";

/** replyCount is a placeholder 0 until the Communication Center (a later
 *  phase) makes inbound-reply counts real and queryable — never
 *  fabricated here, same "unavailable, not zero" discipline this
 *  codebase already applies to every other not-yet-connected metric,
 *  except a score calculation can't render "unavailable" for one input,
 *  so it degrades that one term to 0 rather than failing the whole
 *  score. */
export const scoringService = {
  /** `richContext` is only ever populated by leadInsightService's own
   *  AI-analysis flow (Phase 5, module 5.1) — every other caller
   *  (leadService's every-write recompute) omits it, so the hot path's
   *  DB footprint is unchanged from before 5.1. */
  async computeScore(
    lead: Lead,
    providerId?: string,
    richContext?: Pick<LeadScoreInput, "recentActivities" | "recentMessages" | "opportunities">,
  ): Promise<LeadScoreResult> {
    const activityRepository = await getActivityRepository();
    const activities = await activityRepository.listForEntity({ entityType: "Lead", entityId: lead.id }, 1, 500);
    const followUpCount = activities.items.filter((a) => a.type === "call" || a.type === "meeting" || a.type === "note").length;

    const provider = getScoringProvider(providerId);
    return provider.score({
      lead,
      replyCount: 0,
      followUpCount,
      tagCount: lead.tags?.length ?? 0,
      ...richContext,
    });
  },
};

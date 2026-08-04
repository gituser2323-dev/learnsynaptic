import { bandHealth } from "../health";
import type { LeadScoreInput, LeadScoreResult, ScoringProvider } from "../types";

/**
 * Deliberately simple, deliberately transparent — every weight below is
 * a plain number an admin could sanity-check by hand, not a black box.
 * Score is 0–100; health is a banded read of the same score, so the two
 * never disagree with each other. See "priority" in the admin UI: the
 * same health value, relabeled — a separate priority field would just
 * be able to drift out of sync with health for no benefit.
 */
const SOURCE_WEIGHTS: Record<string, number> = {
  referral: 20,
  website: 12,
  "register-page": 12,
  "ai-bootcamp-funnel": 10,
};
const DEFAULT_SOURCE_WEIGHT = 6;

const STATUS_WEIGHTS: Record<string, number> = {
  new: 0,
  contacted: 10,
  nurture: 15,
  registered: 30,
  closed: -10,
};

const RECENCY_HALF_LIFE_DAYS = 14;

function recencyScore(updatedAt: string): number {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // Exponential decay — a lead touched today scores near 20, one
  // untouched for 2 half-lives scores near 5. Never negative.
  const decayed = 20 * Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
  return Math.max(0, decayed);
}

export const rulesBasedScoringProvider: ScoringProvider = {
  id: "rules-based",

  async score(input: LeadScoreInput): Promise<LeadScoreResult> {
    const { lead, replyCount, followUpCount, tagCount } = input;

    const sourceScore = SOURCE_WEIGHTS[lead.source] ?? DEFAULT_SOURCE_WEIGHT;
    const statusScore = STATUS_WEIGHTS[lead.status] ?? 0;
    const engagementScore = Math.min(20, replyCount * 4);
    const followUpScore = Math.min(15, followUpCount * 3);
    const courseInterestScore = lead.program ? 10 : 0;
    const tagScore = Math.min(5, tagCount);

    const raw = sourceScore + statusScore + engagementScore + followUpScore + courseInterestScore + tagScore + recencyScore(lead.updatedAt);
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    return { score, health: bandHealth(score) };
  },
};

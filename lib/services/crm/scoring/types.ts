import type { Lead } from "@/lib/services/leads/types";
import type { Activity } from "@/lib/services/crm/activities/types";
import type { Message } from "@/lib/services/whatsappCampaigns/types";
import type { Opportunity } from "@/lib/services/crm/pipelines/types";

export type LeadHealth = "hot" | "warm" | "cold";

export interface LeadScoreInput {
  lead: Lead;
  /** Count of inbound replies attributed to this lead — best-effort;
   *  0 until the Communication Center (a later phase) makes this a real,
   *  queryable number. */
  replyCount: number;
  /** Count of counsellor follow-up Activities logged against this lead. */
  followUpCount: number;
  tagCount: number;
  /** AI CRM (Phase 5), Module 5.1 — richer context only the `ai`
   *  provider reads; `rules-based` ignores all three. Deliberately kept
   *  out of the always-computed hot path (leadService's
   *  recomputeAndPersistScore): fetching activities/messages/
   *  opportunities on every lead save would add real DB load to a path
   *  that runs on every create/update. Only
   *  leadInsightService.analyzeLead() gathers and passes these. */
  recentActivities?: Activity[];
  recentMessages?: Message[];
  opportunities?: Opportunity[];
}

export type BuyingIntent = "high" | "medium" | "low" | "unknown";

/** AI CRM (Phase 5), Module 5.1 — only ever populated by the `ai`
 *  provider; `rules-based` never sets this field. */
export interface LeadAiInsightDetail {
  summary: string;
  buyingIntent: BuyingIntent;
  strengths: string[];
  risks: string[];
  nextAction: string;
  /** 0-100 — the model's own stated confidence in this analysis, not a
   *  measure of the lead's quality (that's `score`). */
  confidence: number;
  reasoning: string;
  /** Which vendor actually produced this result — leadInsightService
   *  persists this straight onto the LeadInsight row rather than
   *  re-deriving it from config, so the history always reflects the
   *  vendor that was active *at analysis time*, even if AI_PROVIDER is
   *  changed later. */
  providerId: string;
}

export interface LeadScoreResult {
  score: number;
  health: LeadHealth;
  insight?: LeadAiInsightDetail;
}

/**
 * Provider-registry seam, deliberately shaped like WhatsApp's and
 * Marketing's — the approved Business OS Blueprint's own resolved
 * conflict: AI Lead Scoring (Phase 5, module 5.1) plugs in a second
 * implementation of this exact interface, never a new field or a
 * parallel scoring path. `score()` is async as of 5.1 — the `ai`
 * provider needs to await a real vendor call; `rules-based` stays a
 * synchronous computation internally, just wrapped in a resolved
 * Promise.
 */
export interface ScoringProvider {
  readonly id: "rules-based" | "ai";
  score(input: LeadScoreInput): Promise<LeadScoreResult>;
}

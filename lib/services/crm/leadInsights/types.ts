import type { PaginatedResult } from "@/lib/pagination";
import type { BuyingIntent, LeadHealth } from "@/lib/services/crm/scoring";

/**
 * AI CRM (Phase 5), Module 5.1 — Lead Insights history. One row per
 * analysis run, kept even when the run couldn't produce a real result
 * (no AI provider configured, or the vendor call/response failed) —
 * the module's own "Lead insights history" requirement means a
 * counsellor can see *that* an analysis was attempted and why it
 * didn't produce insights, not just silently see nothing. Never
 * confused with the pre-existing `Lead.score`/`Lead.health` fields
 * (the rules-based score, recomputed on every write) — this is an
 * additive, on-demand history, not a replacement.
 */
export type LeadInsightStatus = "ok" | "unavailable" | "error";
export type LeadInsightTrigger = "manual" | "automation";

export interface LeadInsight {
  id: string;
  leadId: string;
  status: LeadInsightStatus;
  /** Set only when status is "ok". */
  score?: number;
  health?: LeadHealth;
  summary?: string;
  buyingIntent?: BuyingIntent;
  strengths?: string[];
  risks?: string[];
  nextAction?: string;
  confidence?: number;
  reasoning?: string;
  /** Set when status is "unavailable" (no provider configured) or
   *  "error" (vendor call/response failed) — human-readable, shown
   *  directly in the admin UI rather than a generic "something went
   *  wrong." */
  errorMessage?: string;
  /** The vendor that produced this result ("openai"|"anthropic"|
   *  "gemini"), or undefined when status isn't "ok". */
  providerId?: string;
  trigger: LeadInsightTrigger;
  /** User id for a manual "Analyze Again" click; unset for an
   *  automation-triggered run. */
  actorId?: string;
  organizationId?: string;
  createdAt: string;
}

export interface CreateLeadInsightInput {
  leadId: string;
  status: LeadInsightStatus;
  score?: number;
  health?: LeadHealth;
  summary?: string;
  buyingIntent?: BuyingIntent;
  strengths?: string[];
  risks?: string[];
  nextAction?: string;
  confidence?: number;
  reasoning?: string;
  errorMessage?: string;
  providerId?: string;
  trigger: LeadInsightTrigger;
  actorId?: string;
  organizationId?: string;
}

export interface LeadInsightListFilters {
  leadId: string;
}

export interface LeadInsightRepository {
  create(input: CreateLeadInsightInput): Promise<LeadInsight>;
  /** Reverse-chronological — the history panel's own read pattern,
   *  same convention Activity/WebhookDelivery already document. */
  list(filters: LeadInsightListFilters, page: number, limit: number): Promise<PaginatedResult<LeadInsight>>;
  findLatest(leadId: string): Promise<LeadInsight | null>;
}

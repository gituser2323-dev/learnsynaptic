import type { PaginatedResult } from "@/lib/pagination";

/**
 * AI CRM (Phase 5), Module 5.3 — Conversational Analytics. Same shape
 * as 5.1's LeadInsight (one row per analysis run, kept even when a run
 * couldn't produce a real result) for the same reason: "Analysis
 * History" is one of this module's own named requirements, and a
 * counsellor should see *that* an analysis was attempted and why it
 * didn't produce insights, not silently see nothing.
 *
 * Deliberately a separate collection from Conversation/Message — the
 * module's own instruction is explicit: "Store AI analysis separately
 * so conversations remain immutable." Nothing here ever touches a
 * Conversation or Message row.
 */
export type ConversationInsightStatus = "ok" | "unavailable" | "error";
export type ConversationInsightTrigger = "manual" | "automation";
export type ConversationSentiment = "positive" | "neutral" | "negative" | "mixed";
export type ConversationIntent =
  | "inquiry"
  | "ready_to_enroll"
  | "price_negotiation"
  | "objection"
  | "support_request"
  | "unresponsive"
  | "other";

export interface ConversationInsight {
  id: string;
  conversationId: string;
  /** Denormalized from Conversation.leadId at analysis time — the
   *  pointer this module's own "historical analytics for each lead"
   *  requirement queries across every conversation a lead has had. */
  leadId?: string;
  status: ConversationInsightStatus;
  sentiment?: ConversationSentiment;
  intent?: ConversationIntent;
  /** 0-100 — how engaged the contact appears to be in this thread. */
  engagementScore?: number;
  /** 0-100 — how close this contact seems to converting/enrolling. */
  buyingReadinessScore?: number;
  positiveSignals?: string[];
  negativeSignals?: string[];
  /** Specific objections raised, distinct from `negativeSignals` (a
   *  general concern vs. a named reason they might not convert). */
  objections?: string[];
  /** A chronological narrative of the conversation — doubles as both
   *  the module's "conversation summary" and "AI-generated timeline
   *  summary" requirements; a timeline summary IS a conversation
   *  summary framed chronologically, not a second distinct artifact. */
  summary?: string;
  keyTopics?: string[];
  missedOpportunities?: string[];
  suggestedActions?: string[];
  /** "Response quality insights" — an assessment of the counsellor's
   *  own replies in this thread (tone, responsiveness, completeness). */
  responseQualityNotes?: string;
  /** 0-100 — the model's own stated confidence in this analysis. */
  confidence?: number;
  reasoning?: string;
  errorMessage?: string;
  providerId?: string;
  trigger: ConversationInsightTrigger;
  actorId?: string;
  organizationId?: string;
  createdAt: string;
}

export type CreateConversationInsightInput = Omit<ConversationInsight, "id" | "createdAt">;

export interface ConversationInsightListFilters {
  conversationId: string;
}

export interface ConversationInsightRepository {
  create(input: CreateConversationInsightInput): Promise<ConversationInsight>;
  /** Reverse-chronological — same convention every other history list
   *  in this app already documents. */
  list(filters: ConversationInsightListFilters, page: number, limit: number): Promise<PaginatedResult<ConversationInsight>>;
  findLatest(conversationId: string): Promise<ConversationInsight | null>;
  /** "Historical analytics for each lead" / "trend analysis across
   *  conversations" — every insight ever recorded for any conversation
   *  belonging to this lead, newest first, unpaginated (bounded by
   *  `limit`): the aggregation this module's own trend view reads. */
  listForLead(leadId: string, limit: number): Promise<ConversationInsight[]>;
}

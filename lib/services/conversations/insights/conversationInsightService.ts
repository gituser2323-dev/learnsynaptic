import { conversationService } from "../conversationService";
import { leadService } from "@/lib/services/leads";
import { getOpportunityRepository, getConversationInsightRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { getAiProvider, isAiProviderConfigured, AiProviderNotConfiguredError, stripJsonFence } from "@/lib/services/ai";
import type { Message } from "@/lib/services/whatsappCampaigns";
import type { Activity } from "@/lib/services/crm/activities";
import type { Lead } from "@/lib/services/leads";
import type { Opportunity } from "@/lib/services/crm/pipelines";
import type { PaginatedResult } from "@/lib/pagination";
import type {
  ConversationInsight,
  ConversationInsightTrigger,
  ConversationIntent,
  ConversationSentiment,
} from "./types";

const MAX_MESSAGES = 40;
const MAX_NOTES = 10;
const SENTIMENTS: ConversationSentiment[] = ["positive", "neutral", "negative", "mixed"];
const INTENTS: ConversationIntent[] = [
  "inquiry",
  "ready_to_enroll",
  "price_negotiation",
  "objection",
  "support_request",
  "unresponsive",
  "other",
];

const SYSTEM_PROMPT = `You are a conversational-analytics assistant for an ed-tech company's admissions counsellors. \
Given a WhatsApp/email conversation thread, the linked lead's profile, and any sales opportunities, analyze the \
conversation as a whole — sentiment, intent, engagement, buying readiness, objections, and what the counsellor \
should do next. You never modify the conversation or send anything — this is read-only analysis.

Respond with ONLY a single JSON object, no markdown code fences, no commentary before or after it, matching exactly \
this shape:
{
  "sentiment": <"positive" | "neutral" | "negative" | "mixed">,
  "intent": <"inquiry" | "ready_to_enroll" | "price_negotiation" | "objection" | "support_request" | "unresponsive" | "other">,
  "engagementScore": <integer 0-100, how engaged/responsive the contact has been>,
  "buyingReadinessScore": <integer 0-100, how close this contact seems to converting>,
  "positiveSignals": [<short strings, encouraging signs>],
  "negativeSignals": [<short strings, discouraging signs>],
  "objections": [<short strings, specific objections/concerns the contact raised, or empty if none>],
  "summary": <a 3-5 sentence chronological narrative of what happened in this conversation>,
  "keyTopics": [<short strings, the main topics discussed>],
  "missedOpportunities": [<short strings, moments the counsellor could have handled better or followed up on, or empty>],
  "suggestedActions": [<1-3 concrete next actions for the counsellor>],
  "responseQualityNotes": <1-2 sentences assessing the counsellor's own replies in this thread — tone, responsiveness, completeness>,
  "confidence": <integer 0-100, your own confidence in this analysis given the data available>,
  "reasoning": <1-2 sentences explaining the sentiment/buying-readiness call you made>
}`;

function formatMessageLine(message: Message): string {
  const direction = message.direction === "inbound" ? "Contact" : "Counsellor";
  return `[${message.createdAt}] ${direction}: ${message.body ?? "(non-text content)"}`;
}

function buildUserPrompt(messages: Message[], notes: Activity[], lead: Lead | null, opportunities: Opportunity[]): string {
  const leadLines = lead
    ? [
        `Name: ${lead.name}`,
        `Status: ${lead.status}`,
        `Program of interest: ${lead.program ?? "not specified"}`,
        `Source: ${lead.source}`,
        `Rules-based score: ${lead.score}/100 (${lead.health})`,
      ].join("\n")
    : "No linked lead record for this conversation.";

  const messageLines =
    messages
      .slice(-MAX_MESSAGES)
      .map(formatMessageLine)
      .join("\n") || "No messages yet in this conversation.";

  const noteLines =
    notes
      .filter((a) => a.type === "note")
      .slice(0, MAX_NOTES)
      .map((a) => `- [${a.createdAt}] ${a.body}`)
      .join("\n") || "No internal notes.";

  const opportunityLines =
    opportunities
      .map((o) => `- Stage: ${o.stageId}, Status: ${o.status}, Probability: ${o.probability}%`)
      .join("\n") || "No open opportunities.";

  return `LEAD\n${leadLines}\n\nCONVERSATION HISTORY (oldest first)\n${messageLines}\n\nINTERNAL NOTES\n${noteLines}\n\nOPPORTUNITIES\n${opportunityLines}`;
}

interface RawAnalysisResponse {
  sentiment?: unknown;
  intent?: unknown;
  engagementScore?: unknown;
  buyingReadinessScore?: unknown;
  positiveSignals?: unknown;
  negativeSignals?: unknown;
  objections?: unknown;
  summary?: unknown;
  keyTopics?: unknown;
  missedOpportunities?: unknown;
  suggestedActions?: unknown;
  responseQualityNotes?: unknown;
  confidence?: unknown;
  reasoning?: unknown;
}

function clampScore(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export interface ParsedConversationAnalysis {
  sentiment?: ConversationSentiment;
  intent?: ConversationIntent;
  engagementScore?: number;
  buyingReadinessScore?: number;
  positiveSignals: string[];
  negativeSignals: string[];
  objections: string[];
  summary: string;
  keyTopics: string[];
  missedOpportunities: string[];
  suggestedActions: string[];
  responseQualityNotes?: string;
  confidence: number;
  reasoning: string;
}

/** Exported for direct unit testing against synthetic model output —
 *  same approach 5.1/5.2's own response-normalizer tests already use,
 *  since this environment has no real vendor key to round-trip a real
 *  response through. */
export function parseConversationAnalysis(text: string, providerId: string): ParsedConversationAnalysis {
  const stripped = stripJsonFence(text);

  let raw: RawAnalysisResponse;
  try {
    raw = JSON.parse(stripped) as RawAnalysisResponse;
  } catch {
    throw new Error(`Could not parse a conversation analysis from the "${providerId}" response: not valid JSON.`);
  }

  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  if (!summary) throw new Error(`Could not parse a conversation analysis from the "${providerId}" response: missing "summary".`);

  const sentiment = SENTIMENTS.includes(raw.sentiment as ConversationSentiment) ? (raw.sentiment as ConversationSentiment) : undefined;
  const intent = INTENTS.includes(raw.intent as ConversationIntent) ? (raw.intent as ConversationIntent) : undefined;

  return {
    sentiment,
    intent,
    engagementScore: clampScore(raw.engagementScore),
    buyingReadinessScore: clampScore(raw.buyingReadinessScore),
    positiveSignals: asStringArray(raw.positiveSignals),
    negativeSignals: asStringArray(raw.negativeSignals),
    objections: asStringArray(raw.objections),
    summary,
    keyTopics: asStringArray(raw.keyTopics),
    missedOpportunities: asStringArray(raw.missedOpportunities),
    suggestedActions: asStringArray(raw.suggestedActions).slice(0, 3),
    responseQualityNotes: typeof raw.responseQualityNotes === "string" ? raw.responseQualityNotes.trim() : undefined,
    confidence: clampScore(raw.confidence) ?? 0,
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning.trim() : "",
  };
}

export interface AnalyzeConversationOptions {
  trigger: ConversationInsightTrigger;
  actorId?: string;
  requestId?: string;
}

/**
 * AI CRM (Phase 5), Module 5.3 — the one place that gathers a
 * Conversation's message/note history plus its linked Lead and
 * Opportunities and runs it through the configured AI vendor. Reuses
 * 5.1's AI vendor abstraction directly (getAiProvider/
 * isAiProviderConfigured) — no second vendor layer — and 4.1's
 * conversationService.getThread() for context, the same building
 * blocks 5.2's aiReplyService already reused for a different feature.
 *
 * "Store AI analysis separately so conversations remain immutable":
 * this never writes to Conversation/Message, only to its own
 * ConversationInsight collection.
 */
export const conversationInsightService = {
  async analyzeConversation(conversationId: string, options: AnalyzeConversationOptions): Promise<ConversationInsight | null> {
    const thread = await conversationService.getThread(conversationId);
    if (!thread) return null;

    const repository = await getConversationInsightRepository();
    const leadId = thread.conversation.leadId;

    if (!(await isAiProviderConfigured())) {
      return repository.create({
        conversationId,
        leadId,
        status: "unavailable",
        errorMessage: "AI provider is not configured for this environment.",
        trigger: options.trigger,
        actorId: options.actorId,
        organizationId: thread.conversation.organizationId,
      });
    }

    try {
      let lead: Lead | null = null;
      let opportunities: Opportunity[] = [];
      if (leadId) {
        lead = await leadService.getLead(leadId);
        const opportunityRepository = await getOpportunityRepository();
        opportunities = await opportunityRepository.list({ leadId });
      }

      const provider = getAiProvider();
      const completion = await provider.complete({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(thread.messages, thread.activities, lead, opportunities),
      });
      const analysis = parseConversationAnalysis(completion.text, provider.id);

      const insight = await repository.create({
        conversationId,
        leadId,
        status: "ok",
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        engagementScore: analysis.engagementScore,
        buyingReadinessScore: analysis.buyingReadinessScore,
        positiveSignals: analysis.positiveSignals,
        negativeSignals: analysis.negativeSignals,
        objections: analysis.objections,
        summary: analysis.summary,
        keyTopics: analysis.keyTopics,
        missedOpportunities: analysis.missedOpportunities,
        suggestedActions: analysis.suggestedActions,
        responseQualityNotes: analysis.responseQualityNotes,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        providerId: provider.id,
        trigger: options.trigger,
        actorId: options.actorId,
        organizationId: thread.conversation.organizationId,
      });

      if (options.trigger === "manual") {
        await auditLogService.record({
          action: AUDIT_ACTIONS.CONVERSATION_AI_ANALYZED,
          entityType: "Conversation",
          entityId: conversationId,
          actorId: options.actorId,
          requestId: options.requestId,
          metadata: { insightId: insight.id, providerId: provider.id, sentiment: analysis.sentiment },
        });
      }

      return insight;
    } catch (error) {
      const unavailable = error instanceof AiProviderNotConfiguredError;
      return repository.create({
        conversationId,
        leadId,
        status: unavailable ? "unavailable" : "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error during conversation analysis.",
        trigger: options.trigger,
        actorId: options.actorId,
        organizationId: thread.conversation.organizationId,
      });
    }
  },

  async listInsights(conversationId: string, page = 1, limit = 20): Promise<PaginatedResult<ConversationInsight>> {
    const repository = await getConversationInsightRepository();
    return repository.list({ conversationId }, page, limit);
  },

  async getLatestInsight(conversationId: string): Promise<ConversationInsight | null> {
    const repository = await getConversationInsightRepository();
    return repository.findLatest(conversationId);
  },

  /** "Historical analytics for each lead" + "trend analysis across
   *  conversations" — every insight across every conversation this
   *  lead has had, newest first. A read-only aggregation over already-
   *  persisted insights (the same "reuse Analytics services" shape
   *  7.1's pipelineAnalyticsService established — derive numbers from
   *  existing data, no new AI call), not a new analysis. */
  async getLeadHistory(leadId: string, limit = 50): Promise<ConversationInsight[]> {
    const repository = await getConversationInsightRepository();
    return repository.listForLead(leadId, limit);
  },
};

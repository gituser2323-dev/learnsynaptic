import { conversationService } from "../conversationService";
import { leadService } from "@/lib/services/leads";
import { getOpportunityRepository } from "@/lib/db";
import { getAiProvider, isAiProviderConfigured, AiProviderNotConfiguredError, stripJsonFence } from "@/lib/services/ai";
import type { Message } from "@/lib/services/whatsappCampaigns";
import type { Activity } from "@/lib/services/crm/activities";
import type { Lead } from "@/lib/services/leads";
import type { Opportunity } from "@/lib/services/crm/pipelines";
import type { GenerateReplyResult, ReplySuggestion, ReplyTone } from "./types";

const MAX_MESSAGES = 20;
const MAX_NOTES = 5;

const TONE_INSTRUCTIONS: Record<ReplyTone, string> = {
  professional: "Professional: formal, businesslike, no slang or emoji.",
  friendly: "Friendly: warm and conversational, like a helpful person, not a script.",
  concise: "Concise: as short as possible while still answering — a sentence or two, not a paragraph.",
  follow_up: "Follow-up: this is a proactive check-in, not necessarily a direct reply to the last message — written as if re-engaging a lead who's gone quiet.",
};

const SYSTEM_PROMPT_PREFIX = `You are a reply-drafting assistant for an ed-tech company's admissions counsellors, working \
inside a WhatsApp/email conversation thread. Draft ONE suggested reply a counsellor could send as-is or edit — you never \
send anything yourself, only suggest. Reply in the same language/style the contact has been using where you can tell \
(English, Hindi, or a Hindi-English mix are all common) — note your best guess in detectedLanguage, or omit it if unclear.

Respond with ONLY a single JSON object, no markdown code fences, no commentary before or after it, matching exactly \
this shape:
{
  "replyText": <the suggested reply itself, ready to send>,
  "confidence": <integer 0-100, your own confidence this reply fits the situation>,
  "reasoning": <1-2 sentences: why this reply, given the conversation and lead context>,
  "suggestedFollowUps": [<0-3 short follow-up questions a counsellor might ask next>],
  "detectedLanguage": <your best guess, e.g. "English", "Hindi", "Hinglish" — omit the field entirely if you can't tell>
}`;

function formatMessageLine(message: Message): string {
  const direction = message.direction === "inbound" ? "Contact" : "Counsellor";
  return `[${message.createdAt}] ${direction}: ${message.body ?? "(non-text content)"}`;
}

function buildUserPrompt(
  tone: ReplyTone,
  messages: Message[],
  notes: Activity[],
  lead: Lead | null,
  opportunities: Opportunity[],
): string {
  const toneLine = `TONE: ${TONE_INSTRUCTIONS[tone]}`;

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

  return `${toneLine}\n\nLEAD\n${leadLines}\n\nCONVERSATION HISTORY (oldest first)\n${messageLines}\n\nINTERNAL NOTES\n${noteLines}\n\nOPPORTUNITIES\n${opportunityLines}`;
}

interface RawReplyResponse {
  replyText?: unknown;
  confidence?: unknown;
  reasoning?: unknown;
  suggestedFollowUps?: unknown;
  detectedLanguage?: unknown;
}

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/** Exported for direct unit testing against synthetic model output —
 *  same approach 5.1's parseLeadInsightResponse already established,
 *  since this environment has no real vendor key to round-trip a real
 *  response through. */
export function parseReplySuggestion(text: string, tone: ReplyTone, providerId: string): ReplySuggestion {
  const stripped = stripJsonFence(text);

  let raw: RawReplyResponse;
  try {
    raw = JSON.parse(stripped) as RawReplyResponse;
  } catch {
    throw new Error(`Could not parse a reply suggestion from the "${providerId}" response: not valid JSON.`);
  }

  const replyText = typeof raw.replyText === "string" ? raw.replyText.trim() : "";
  if (!replyText) throw new Error(`Could not parse a reply suggestion from the "${providerId}" response: missing "replyText".`);

  const detectedLanguage = typeof raw.detectedLanguage === "string" && raw.detectedLanguage.trim() ? raw.detectedLanguage.trim() : undefined;

  return {
    replyText,
    tone,
    confidence: clampConfidence(raw.confidence),
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning.trim() : "",
    suggestedFollowUps: asStringArray(raw.suggestedFollowUps).slice(0, 3),
    detectedLanguage,
    providerId,
  };
}

/**
 * AI CRM (Phase 5), Module 5.2 — the one place that gathers Conversation
 * history + Lead + Activities (internal notes) + Opportunities and asks
 * the configured AI vendor to draft a suggested reply. Never sends
 * anything: the result is a plain suggestion object, handed back to the
 * caller (the admin API route, then the UI) — actually sending still
 * goes through conversationService.sendReply(), the exact same
 * primitive the manual composer and 3.3's Auto-Reply Engine already
 * use, so this module adds no second send path.
 *
 * Deliberately NOT built on 3.1's WorkflowDefinition engine or 3.3's
 * AutoReplyRule catalog, the same call 3.3 itself made about 3.1: both
 * of those exist to send *without* a human in the loop (a scheduled
 * workflow step, a keyword-matched auto-reply); this feature's entire
 * point is a human reviewing, editing, and only then sending. The only
 * thing actually shared with either is the send primitive itself.
 *
 * Deliberately NOT audit-logged: unlike 5.1's manual "Analyze Again"
 * (which writes lead.ai_insight_analyzed), generating or regenerating a
 * suggestion changes no persisted state at all — nothing happens until
 * a counsellor sends the resulting message, and that send is already
 * covered by whatever audit posture conversationService.sendReply()
 * itself has. Logging every generate/regenerate click would also be
 * far higher-frequency than 5.1's analysis runs (a counsellor might
 * regenerate several times per reply), the same "high-frequency, no
 * state change" threshold that already excludes plain Activity logging
 * from the business audit log.
 */
export const aiReplyService = {
  /** Returns null when the conversation id doesn't resolve — the
   *  caller (the API route) turns that into a 404, the same shape
   *  conversationService.sendReply() already uses for "not found." */
  async generateReply(conversationId: string, tone: ReplyTone): Promise<GenerateReplyResult | null> {
    const thread = await conversationService.getThread(conversationId);
    if (!thread) return null;

    if (!(await isAiProviderConfigured())) {
      return { success: false, reason: "unavailable", message: "AI provider is not configured for this environment." };
    }

    let lead: Lead | null = null;
    let opportunities: Opportunity[] = [];
    if (thread.conversation.leadId) {
      lead = await leadService.getLead(thread.conversation.leadId);
      const opportunityRepository = await getOpportunityRepository();
      opportunities = await opportunityRepository.list({ leadId: thread.conversation.leadId });
    }

    try {
      const provider = getAiProvider();
      const completion = await provider.complete({
        systemPrompt: SYSTEM_PROMPT_PREFIX,
        userPrompt: buildUserPrompt(tone, thread.messages, thread.activities, lead, opportunities),
      });
      const suggestion = parseReplySuggestion(completion.text, tone, provider.id);
      return { success: true, suggestion };
    } catch (error) {
      if (error instanceof AiProviderNotConfiguredError) {
        return { success: false, reason: "unavailable", message: error.message };
      }
      return { success: false, reason: "error", message: error instanceof Error ? error.message : "Unknown error generating a reply." };
    }
  },
};

import { getAiProvider, isAiProviderConfigured, AiProviderNotConfiguredError, AiResponseParseError, stripJsonFence } from "@/lib/services/ai";
import { bandHealth } from "../health";
import type { BuyingIntent, LeadAiInsightDetail, LeadScoreInput, LeadScoreResult, ScoringProvider } from "../types";

const BUYING_INTENTS: BuyingIntent[] = ["high", "medium", "low", "unknown"];

const SYSTEM_PROMPT = `You are a CRM sales-insight assistant for an ed-tech company's admissions counsellors. \
Given a lead's profile, recent activity, recent WhatsApp/email messages, and any sales opportunities, assess how \
likely they are to enroll and what a counsellor should do next.

Respond with ONLY a single JSON object, no markdown code fences, no commentary before or after it, matching exactly \
this shape:
{
  "score": <integer 0-100, overall lead quality/priority>,
  "buyingIntent": <"high" | "medium" | "low" | "unknown">,
  "strengths": [<short strings, positive signals>],
  "risks": [<short strings, warning signs or reasons they might not convert>],
  "nextAction": <one concrete, specific recommended next step for the counsellor>,
  "confidence": <integer 0-100, your own confidence in this analysis given the data available>,
  "summary": <2-3 sentence plain-English summary of this lead>,
  "reasoning": <1-2 sentence explanation of why you scored/classified it this way>
}`;

/** Keeps the prompt bounded regardless of how much history a lead has
 *  accumulated — the model only needs recent signal, not a full replay. */
const MAX_ACTIVITIES = 10;
const MAX_MESSAGES = 10;

function buildUserPrompt(input: LeadScoreInput): string {
  const { lead, recentActivities = [], recentMessages = [], opportunities = [] } = input;

  const leadSummary = [
    `Name: ${lead.name}`,
    `Status: ${lead.status}`,
    `Program of interest: ${lead.program ?? "not specified"}`,
    `Source: ${lead.source}`,
    `Tags: ${lead.tags?.length ? lead.tags.join(", ") : "none"}`,
    `Initial message: ${lead.message ?? "none"}`,
    `Existing rules-based score: ${lead.score}/100 (${lead.health})`,
    `Created: ${lead.createdAt}`,
    `Last updated: ${lead.updatedAt}`,
  ].join("\n");

  const activityLines = recentActivities
    .slice(0, MAX_ACTIVITIES)
    .map((a) => `- [${a.createdAt}] (${a.type}) ${a.body}`)
    .join("\n") || "None logged.";

  const messageLines = recentMessages
    .slice(0, MAX_MESSAGES)
    .map((m) => `- [${m.createdAt}] (${m.direction ?? "outbound"}) ${m.body ?? "(no text)"}`)
    .join("\n") || "None yet.";

  const opportunityLines = opportunities
    .map((o) => `- Stage: ${o.stageId}, Status: ${o.status}, Probability: ${o.probability}%, Expected revenue: ${o.expectedRevenueInr ?? "unspecified"}`)
    .join("\n") || "No open opportunities.";

  return `LEAD PROFILE\n${leadSummary}\n\nRECENT ACTIVITIES (counsellor notes/calls/meetings)\n${activityLines}\n\nRECENT MESSAGES (WhatsApp/email)\n${messageLines}\n\nOPPORTUNITIES\n${opportunityLines}`;
}

interface RawInsightResponse {
  score?: unknown;
  buyingIntent?: unknown;
  strengths?: unknown;
  risks?: unknown;
  nextAction?: unknown;
  confidence?: unknown;
  summary?: unknown;
  reasoning?: unknown;
}

function clampInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/** Exported for direct unit testing against synthetic model output —
 *  same "test the response-normalizer directly" approach 2.3's Graph
 *  API response parsing already used, since no real model call happens
 *  in this environment without a configured vendor key. */
export function parseLeadInsightResponse(text: string, providerId: "openai" | "anthropic" | "gemini"): LeadScoreResult {
  const stripped = stripJsonFence(text);

  let raw: RawInsightResponse;
  try {
    raw = JSON.parse(stripped) as RawInsightResponse;
  } catch {
    throw new AiResponseParseError(providerId, "response was not valid JSON");
  }

  const score = clampInt(raw.score);
  if (score === null) throw new AiResponseParseError(providerId, "missing or non-numeric \"score\"");

  const confidence = clampInt(raw.confidence) ?? 0;
  const buyingIntent: BuyingIntent = BUYING_INTENTS.includes(raw.buyingIntent as BuyingIntent)
    ? (raw.buyingIntent as BuyingIntent)
    : "unknown";
  const nextAction = typeof raw.nextAction === "string" && raw.nextAction.trim() ? raw.nextAction.trim() : "No specific action suggested.";
  const summary = typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : "";
  const reasoning = typeof raw.reasoning === "string" && raw.reasoning.trim() ? raw.reasoning.trim() : "";
  if (!summary) throw new AiResponseParseError(providerId, "missing \"summary\"");

  const insight: LeadAiInsightDetail = {
    summary,
    buyingIntent,
    strengths: asStringArray(raw.strengths),
    risks: asStringArray(raw.risks),
    nextAction,
    confidence,
    reasoning,
    providerId,
  };

  return { score, health: bandHealth(score), insight };
}

export const aiScoringProvider: ScoringProvider = {
  id: "ai",

  async score(input: LeadScoreInput): Promise<LeadScoreResult> {
    if (!(await isAiProviderConfigured())) {
      throw new AiProviderNotConfiguredError("no AI_PROVIDER/API key configured for this environment");
    }

    const provider = getAiProvider();
    const completion = await provider.complete({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
    });

    return parseLeadInsightResponse(completion.text, provider.id);
  },
};

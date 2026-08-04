import { describe, it, expect } from "vitest";
import { parseLeadInsightResponse } from "./providers/ai.provider";
import { getScoringProvider } from "./registry";
import { AiProviderNotConfiguredError } from "@/lib/services/ai";
import type { Lead } from "@/lib/services/leads/types";

/**
 * AI CRM (Phase 5), Module 5.1.
 *
 * parseLeadInsightResponse is exercised directly against synthetic
 * model output, the same "test the response-normalizer directly"
 * approach 2.3's Graph-API-response-normalizing functions already
 * used — this environment has no configured AI_PROVIDER/API key, so
 * there is no real model response to round-trip through in a test run,
 * only the parsing/validation logic itself, which is exactly what a
 * real vendor's (occasionally malformed) output needs to survive.
 */
describe("parseLeadInsightResponse", () => {
  const validJson = JSON.stringify({
    score: 78,
    buyingIntent: "high",
    strengths: ["Responsive to WhatsApp follow-ups", "Asked about EMI options"],
    risks: ["Has not confirmed a start date"],
    nextAction: "Call to confirm enrollment this week.",
    confidence: 85,
    summary: "A highly engaged lead close to converting.",
    reasoning: "Multiple positive replies and pricing questions signal strong intent.",
  });

  it("parses a well-formed response", () => {
    const result = parseLeadInsightResponse(validJson, "anthropic");
    expect(result.score).toBe(78);
    expect(result.health).toBe("hot");
    expect(result.insight?.buyingIntent).toBe("high");
    expect(result.insight?.strengths).toHaveLength(2);
    expect(result.insight?.risks).toHaveLength(1);
    expect(result.insight?.confidence).toBe(85);
    expect(result.insight?.providerId).toBe("anthropic");
  });

  it("strips a ```json markdown fence some models add despite instructions not to", () => {
    const fenced = "```json\n" + validJson + "\n```";
    const result = parseLeadInsightResponse(fenced, "openai");
    expect(result.score).toBe(78);
  });

  it("clamps an out-of-range score into 0-100", () => {
    const result = parseLeadInsightResponse(JSON.stringify({ ...JSON.parse(validJson), score: 150 }), "openai");
    expect(result.score).toBe(100);
  });

  it("defaults an unrecognized buyingIntent to 'unknown' rather than rejecting the whole response", () => {
    const result = parseLeadInsightResponse(JSON.stringify({ ...JSON.parse(validJson), buyingIntent: "extremely-high" }), "gemini");
    expect(result.insight?.buyingIntent).toBe("unknown");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseLeadInsightResponse("not json at all", "openai")).toThrow(/valid JSON/);
  });

  it("throws when score is missing", () => {
    const { score: _score, ...rest } = JSON.parse(validJson);
    expect(() => parseLeadInsightResponse(JSON.stringify(rest), "openai")).toThrow(/score/);
  });

  it("throws when summary is missing", () => {
    const { summary: _summary, ...rest } = JSON.parse(validJson);
    expect(() => parseLeadInsightResponse(JSON.stringify(rest), "openai")).toThrow(/summary/);
  });
});

describe("aiScoringProvider — graceful failure when unconfigured", () => {
  const lead: Lead = {
    id: "lead-1",
    name: "Test Lead",
    email: "test@example.com",
    phone: "+919876500000",
    source: "website",
    status: "new",
    tags: [],
    customFields: {},
    score: 50,
    health: "warm",
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("throws AiProviderNotConfiguredError in this environment (no AI_PROVIDER/API key set)", async () => {
    const provider = getScoringProvider("ai");
    await expect(provider.score({ lead, replyCount: 0, followUpCount: 0, tagCount: 0 })).rejects.toThrow(AiProviderNotConfiguredError);
  });
});

describe("rulesBasedScoringProvider — unaffected by the async signature change", () => {
  it("still returns a plain score/health with no insight field", async () => {
    const provider = getScoringProvider("rules-based");
    const lead: Lead = {
      id: "lead-2",
      name: "Rules Lead",
      email: "rules@example.com",
      phone: "+919876500001",
      source: "referral",
      status: "new",
      tags: [],
      customFields: {},
      score: 0,
      health: "cold",
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = await provider.score({ lead, replyCount: 0, followUpCount: 0, tagCount: 0 });
    expect(typeof result.score).toBe("number");
    expect(["hot", "warm", "cold"]).toContain(result.health);
    expect(result.insight).toBeUndefined();
  });
});

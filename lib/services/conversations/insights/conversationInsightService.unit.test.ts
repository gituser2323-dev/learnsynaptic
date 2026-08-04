import { describe, it, expect } from "vitest";
import { parseConversationAnalysis, conversationInsightService } from "./conversationInsightService";
import { conversationService } from "../conversationService";

/**
 * AI CRM (Phase 5), Module 5.3.
 *
 * Same posture as 5.1/5.2's own suites: parseConversationAnalysis is
 * exercised directly against synthetic model output (this environment
 * has no configured AI_PROVIDER/API key), and analyzeConversation's
 * graceful-degradation path is exercised for real against a real
 * in-memory conversation.
 */
describe("parseConversationAnalysis", () => {
  const validJson = JSON.stringify({
    sentiment: "positive",
    intent: "ready_to_enroll",
    engagementScore: 78,
    buyingReadinessScore: 85,
    positiveSignals: ["Asked about enrollment deadline", "Confirmed budget is available"],
    negativeSignals: ["Hesitant about the 6-month duration"],
    objections: ["Wants a payment plan before committing"],
    summary: "The contact asked about the GenAI Builder program, confirmed interest, and raised a payment-plan question.",
    keyTopics: ["Program fees", "Payment plan", "Batch start date"],
    missedOpportunities: ["Counsellor didn't offer the EMI option proactively"],
    suggestedActions: ["Share EMI options", "Confirm next cohort start date"],
    responseQualityNotes: "Counsellor replies were prompt and on-topic.",
    confidence: 82,
    reasoning: "Multiple direct enrollment questions and budget confirmation signal high buying readiness.",
  });

  it("parses a well-formed response", () => {
    const result = parseConversationAnalysis(validJson, "anthropic");
    expect(result.sentiment).toBe("positive");
    expect(result.intent).toBe("ready_to_enroll");
    expect(result.engagementScore).toBe(78);
    expect(result.buyingReadinessScore).toBe(85);
    expect(result.positiveSignals).toHaveLength(2);
    expect(result.negativeSignals).toHaveLength(1);
    expect(result.objections).toHaveLength(1);
    expect(result.keyTopics).toHaveLength(3);
    expect(result.missedOpportunities).toHaveLength(1);
    expect(result.suggestedActions).toHaveLength(2);
    expect(result.confidence).toBe(82);
  });

  it("strips a ```json markdown fence some models add despite instructions not to", () => {
    const fenced = "```json\n" + validJson + "\n```";
    const result = parseConversationAnalysis(fenced, "openai");
    expect(result.sentiment).toBe("positive");
  });

  it("clamps out-of-range scores into 0-100", () => {
    const result = parseConversationAnalysis(
      JSON.stringify({ ...JSON.parse(validJson), engagementScore: 250, buyingReadinessScore: -10 }),
      "openai",
    );
    expect(result.engagementScore).toBe(100);
    expect(result.buyingReadinessScore).toBe(0);
  });

  it("defaults an unrecognized sentiment/intent to undefined rather than rejecting the whole response", () => {
    const result = parseConversationAnalysis(
      JSON.stringify({ ...JSON.parse(validJson), sentiment: "ecstatic", intent: "buying_a_house" }),
      "openai",
    );
    expect(result.sentiment).toBeUndefined();
    expect(result.intent).toBeUndefined();
  });

  it("truncates suggestedActions to at most 3", () => {
    const withFive = { ...JSON.parse(validJson), suggestedActions: ["a", "b", "c", "d", "e"] };
    const result = parseConversationAnalysis(JSON.stringify(withFive), "openai");
    expect(result.suggestedActions).toHaveLength(3);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseConversationAnalysis("not json at all", "openai")).toThrow(/valid JSON/);
  });

  it("throws when summary is missing", () => {
    const { summary: _summary, ...rest } = JSON.parse(validJson);
    expect(() => parseConversationAnalysis(JSON.stringify(rest), "openai")).toThrow(/summary/);
  });
});

describe("conversationInsightService.analyzeConversation — graceful degradation", () => {
  it("returns an 'unavailable' insight (no AI provider configured in this environment) rather than throwing", async () => {
    const conversation = await conversationService.getOrCreateForContact("+919876533001", "whatsapp", "Conversation Insight Test");
    const insight = await conversationInsightService.analyzeConversation(conversation.id, { trigger: "manual" });
    expect(insight).not.toBeNull();
    expect(insight?.status).toBe("unavailable");
    expect(insight?.conversationId).toBe(conversation.id);
  });

  it("returns null for a conversation id that doesn't exist, rather than throwing", async () => {
    const insight = await conversationInsightService.analyzeConversation("no-such-conversation-id", { trigger: "manual" });
    expect(insight).toBeNull();
  });

  it("listInsights returns this conversation's runs newest-first", async () => {
    const conversation = await conversationService.getOrCreateForContact("+919876533002", "whatsapp", "History Test");
    await conversationInsightService.analyzeConversation(conversation.id, { trigger: "manual" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await conversationInsightService.analyzeConversation(conversation.id, { trigger: "automation" });

    const page = await conversationInsightService.listInsights(conversation.id, 1, 20);
    expect(page.total).toBe(2);
    expect(page.items[0].trigger).toBe("automation");
    expect(page.items[1].trigger).toBe("manual");
  });

  it("getLatestInsight returns null for a conversation with no analysis history", async () => {
    const conversation = await conversationService.getOrCreateForContact("+919876533003", "whatsapp", "No History Test");
    const latest = await conversationInsightService.getLatestInsight(conversation.id);
    expect(latest).toBeNull();
  });
});

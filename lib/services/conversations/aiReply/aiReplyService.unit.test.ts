import { describe, it, expect } from "vitest";
import { parseReplySuggestion } from "./aiReplyService";
import { aiReplyService } from "./aiReplyService";
import { conversationService } from "../conversationService";

/**
 * AI CRM (Phase 5), Module 5.2.
 *
 * Same posture as 5.1's own test suite: parseReplySuggestion is
 * exercised directly against synthetic model output (this environment
 * has no configured AI_PROVIDER/API key, so there's no real response to
 * round-trip through), and generateReply's graceful-degradation path is
 * exercised for real against a real in-memory conversation.
 */
describe("parseReplySuggestion", () => {
  const validJson = JSON.stringify({
    replyText: "Thanks for reaching out! I can help you with the GenAI Builder program details.",
    confidence: 82,
    reasoning: "The contact asked directly about program details, so a direct, helpful answer fits.",
    suggestedFollowUps: ["Would you like the fee breakdown?", "Should I share the next cohort's start date?"],
    detectedLanguage: "English",
  });

  it("parses a well-formed response", () => {
    const result = parseReplySuggestion(validJson, "professional", "anthropic");
    expect(result.replyText).toContain("GenAI Builder");
    expect(result.confidence).toBe(82);
    expect(result.suggestedFollowUps).toHaveLength(2);
    expect(result.detectedLanguage).toBe("English");
    expect(result.tone).toBe("professional");
    expect(result.providerId).toBe("anthropic");
  });

  it("strips a ```json markdown fence some models add despite instructions not to", () => {
    const fenced = "```json\n" + validJson + "\n```";
    const result = parseReplySuggestion(fenced, "friendly", "openai");
    expect(result.confidence).toBe(82);
  });

  it("clamps an out-of-range confidence into 0-100", () => {
    const result = parseReplySuggestion(JSON.stringify({ ...JSON.parse(validJson), confidence: 250 }), "concise", "openai");
    expect(result.confidence).toBe(100);
  });

  it("truncates suggestedFollowUps to at most 3", () => {
    const withFive = { ...JSON.parse(validJson), suggestedFollowUps: ["a", "b", "c", "d", "e"] };
    const result = parseReplySuggestion(JSON.stringify(withFive), "professional", "openai");
    expect(result.suggestedFollowUps).toHaveLength(3);
  });

  it("omits detectedLanguage when the model didn't return one, rather than guessing", () => {
    const { detectedLanguage: _detectedLanguage, ...rest } = JSON.parse(validJson);
    const result = parseReplySuggestion(JSON.stringify(rest), "professional", "openai");
    expect(result.detectedLanguage).toBeUndefined();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseReplySuggestion("not json at all", "professional", "openai")).toThrow(/valid JSON/);
  });

  it("throws when replyText is missing", () => {
    const { replyText: _replyText, ...rest } = JSON.parse(validJson);
    expect(() => parseReplySuggestion(JSON.stringify(rest), "professional", "openai")).toThrow(/replyText/);
  });
});

describe("aiReplyService.generateReply — graceful degradation", () => {
  it("returns an 'unavailable' result (no AI provider configured in this environment) rather than throwing", async () => {
    const conversation = await conversationService.getOrCreateForContact("+919876511001", "whatsapp", "AI Reply Test Contact");
    const result = await aiReplyService.generateReply(conversation.id, "professional");
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe("unavailable");
  });

  it("returns null for a conversation id that doesn't exist, rather than throwing", async () => {
    const result = await aiReplyService.generateReply("no-such-conversation-id", "professional");
    expect(result).toBeNull();
  });
});

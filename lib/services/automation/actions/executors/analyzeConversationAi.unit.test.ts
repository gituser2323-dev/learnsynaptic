import { describe, it, expect } from "vitest";
import { analyzeConversationAi } from "./analyzeConversationAi";
import { leadService } from "@/lib/services/leads";
import { conversationService } from "@/lib/services/conversations";
import { conversationInsightService } from "@/lib/services/conversations/insights";

/**
 * AI CRM (Phase 5), Module 5.3 — "reuse Workflow Automation." The
 * WorkflowRun engine only ever runs against Lead entities, so this
 * step resolves the lead's own most-recently-active conversation
 * before analyzing it (see analyzeConversationAi.ts's own doc comment).
 */
let phoneCounter = 0;
async function createTestLead(): Promise<string> {
  phoneCounter += 1;
  const result = await leadService.registerLead({
    name: `Automation Conversation Insight Lead ${phoneCounter}`,
    email: `automation-conv-insight-${phoneCounter}@example.com`,
    phone: `+9198763${String(phoneCounter).padStart(5, "0")}`,
    source: "website",
  });
  if (!result.success) throw new Error("Failed to create test lead");
  return result.lead.id;
}

describe("analyzeConversationAi action executor", () => {
  it("rejects a non-Lead entity type", async () => {
    await expect(analyzeConversationAi({ entityType: "Opportunity", entityId: "opp-1", data: {}, runId: "test-run" }, {})).rejects.toThrow(
      /requires a Lead entity/,
    );
  });

  it("no-ops (does not throw) for a lead with no conversation yet — the common case", async () => {
    const leadId = await createTestLead();
    await expect(analyzeConversationAi({ entityType: "Lead", entityId: leadId, data: {}, runId: "test-run" }, {})).resolves.toBeUndefined();
  });

  it("analyzes the lead's own conversation and degrades gracefully when no AI provider is configured", async () => {
    const leadId = await createTestLead();
    const lead = await leadService.getLead(leadId);
    const conversation = await conversationService.getOrCreateForContact(lead!.phone, "whatsapp", lead!.name);
    // Link the conversation to the lead the same way a real inbound
    // message would (conversationService.recordInboundMessage sets
    // leadId on first resolution) — done directly here since this test
    // only needs the leadId link to exist, not a full inbound message.
    const repository = await (await import("@/lib/db")).getConversationRepository();
    await repository.update(conversation.id, { leadId });

    await analyzeConversationAi({ entityType: "Lead", entityId: leadId, data: {}, runId: "test-run" }, {});

    const latest = await conversationInsightService.getLatestInsight(conversation.id);
    expect(latest?.status).toBe("unavailable");
    expect(latest?.trigger).toBe("automation");
  });
});

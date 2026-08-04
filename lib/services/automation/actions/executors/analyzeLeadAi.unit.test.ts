import { describe, it, expect } from "vitest";
import { analyzeLeadAi } from "./analyzeLeadAi";
import { leadService } from "@/lib/services/leads";
import { leadInsightService } from "@/lib/services/crm/leadInsights";

/**
 * AI CRM (Phase 5), Module 5.1 — "Automatic analysis triggers" via the
 * Automation Platform. This environment has no AI_PROVIDER configured,
 * so what matters here is that the step itself never throws over a
 * missing vendor (which would fail the whole WorkflowRun) — it must
 * degrade exactly the same way the manual "Analyze Again" button does.
 */
let phoneCounter = 0;
async function createTestLead(): Promise<string> {
  phoneCounter += 1;
  const result = await leadService.registerLead({
    name: `Automation Insight Lead ${phoneCounter}`,
    email: `automation-insight-${phoneCounter}@example.com`,
    phone: `+9198764${String(phoneCounter).padStart(5, "0")}`,
    source: "website",
  });
  if (!result.success) throw new Error("Failed to create test lead");
  return result.lead.id;
}

describe("analyzeLeadAi action executor", () => {
  it("rejects a non-Lead entity type", async () => {
    await expect(analyzeLeadAi({ entityType: "Opportunity", entityId: "opp-1", data: {}, runId: "test-run" }, {})).rejects.toThrow(/requires a Lead entity/);
  });

  it("does not throw when no AI provider is configured — persists an 'unavailable' insight instead", async () => {
    const leadId = await createTestLead();
    await expect(analyzeLeadAi({ entityType: "Lead", entityId: leadId, data: {}, runId: "test-run" }, {})).resolves.toBeUndefined();

    const latest = await leadInsightService.getLatestInsight(leadId);
    expect(latest?.status).toBe("unavailable");
    expect(latest?.trigger).toBe("automation");
  });

  it("still throws for a lead id that doesn't exist", async () => {
    await expect(analyzeLeadAi({ entityType: "Lead", entityId: "no-such-lead", data: {}, runId: "test-run" }, {})).rejects.toThrow(/not found/);
  });
});

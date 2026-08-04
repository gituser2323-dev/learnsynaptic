import { describe, it, expect } from "vitest";
import { leadInsightService } from "./leadInsightService";
import { leadService } from "@/lib/services/leads";

/**
 * AI CRM (Phase 5), Module 5.1.
 *
 * This test environment has no AI_PROVIDER/API key configured (see
 * .env.example — deliberately blank by default), so analyzeLead's
 * "real vendor call succeeds" path can't be exercised here without a
 * real key; what these tests lock in is the module's own "fail
 * gracefully when no AI provider is configured" requirement — a
 * missing provider must persist a real history row and return
 * normally, never throw up to a caller (the API route, or an
 * automation step).
 */
let phoneCounter = 0;
async function createTestLead(): Promise<string> {
  phoneCounter += 1;
  const result = await leadService.registerLead({
    name: `Insight Test Lead ${phoneCounter}`,
    email: `insight-test-${phoneCounter}@example.com`,
    phone: `+9198765${String(phoneCounter).padStart(5, "0")}`,
    source: "website",
  });
  if (!result.success) throw new Error(`Failed to create test lead: ${JSON.stringify(result.errors)}`);
  return result.lead.id;
}

describe("leadInsightService.analyzeLead — graceful degradation", () => {
  it("persists an 'unavailable' row and returns normally when no AI provider is configured", async () => {
    const leadId = await createTestLead();
    const insight = await leadInsightService.analyzeLead(leadId, { trigger: "manual", actorId: "user-1" });

    expect(insight.status).toBe("unavailable");
    expect(insight.leadId).toBe(leadId);
    expect(insight.trigger).toBe("manual");
    expect(insight.errorMessage).toBeTruthy();
    expect(insight.score).toBeUndefined();
  });

  it("throws for a lead id that doesn't exist — a real error, not a degraded result", async () => {
    await expect(leadInsightService.analyzeLead("no-such-lead-id", { trigger: "manual" })).rejects.toThrow(/not found/);
  });

  it("an automation-triggered analysis degrades the same way as a manual one", async () => {
    const leadId = await createTestLead();
    const insight = await leadInsightService.analyzeLead(leadId, { trigger: "automation" });
    expect(insight.status).toBe("unavailable");
    expect(insight.trigger).toBe("automation");
  });
});

describe("leadInsightService history", () => {
  it("listInsights returns this lead's runs newest-first", async () => {
    const leadId = await createTestLead();
    await leadInsightService.analyzeLead(leadId, { trigger: "manual" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await leadInsightService.analyzeLead(leadId, { trigger: "automation" });

    const page = await leadInsightService.listInsights(leadId, 1, 20);
    expect(page.total).toBe(2);
    expect(page.items[0].trigger).toBe("automation");
    expect(page.items[1].trigger).toBe("manual");
  });

  it("getLatestInsight returns null for a lead with no analysis history", async () => {
    const leadId = await createTestLead();
    const latest = await leadInsightService.getLatestInsight(leadId);
    expect(latest).toBeNull();
  });
});

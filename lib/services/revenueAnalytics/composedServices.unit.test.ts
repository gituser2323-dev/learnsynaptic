import { describe, it, expect } from "vitest";
import { getCampaignRoi } from "./campaignRoiService";
import { getWhatsAppRevenue } from "./whatsappRevenueService";
import { getCounsellorRevenueStats } from "./counsellorRevenueService";
import { getAutomationRoi } from "./automationRoiService";
import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Campaign ROI (§7),
 * WhatsApp Performance + Revenue (§8), Counsellor + Revenue (§6), and
 * Automation ROI (§9): these four are deliberate thin reshapes/
 * compositions over already-deeply-tested logic (getRevenueAttribution,
 * getWorkflowPerformance, 7.1's pipelineAnalyticsService, 1.6's
 * leaderboardService — see each service file's own module doc). These
 * tests confirm the composition itself is wired correctly and never
 * throws on a real (if empty-ish) dataset — not a re-verification of
 * logic already covered by workflowPerformanceService.unit.test.ts /
 * attributionService.unit.test.ts / etc.
 */
function wideRange(): DateRange {
  return { from: new Date(Date.now() - 60_000).toISOString(), to: new Date(Date.now() + 60_000).toISOString() };
}

describe("getCampaignRoi", () => {
  it("resolves without throwing and returns a well-formed, sorted-by-revenue result", async () => {
    const result = await getCampaignRoi(wideRange());
    expect(result.campaigns).toBeInstanceOf(Array);
    for (let i = 1; i < result.campaigns.length; i++) {
      expect(result.campaigns[i - 1].revenueInr).toBeGreaterThanOrEqual(result.campaigns[i].revenueInr);
    }
  });
});

describe("getWhatsAppRevenue", () => {
  it("resolves without throwing; leadsGenerated is always null (disclosed, not fabricated)", async () => {
    const result = await getWhatsAppRevenue(wideRange());
    expect(result.campaigns).toBeInstanceOf(Array);
    for (const campaign of result.campaigns) {
      expect(campaign.leadsGenerated).toBeNull();
    }
  });
});

describe("getCounsellorRevenueStats", () => {
  it("resolves without throwing and merges 7.1/1.6 fields alongside the new revenueInr/conversationsAssignedCount", async () => {
    const result = await getCounsellorRevenueStats(wideRange());
    expect(result.counsellors).toBeInstanceOf(Array);
    for (const counsellor of result.counsellors) {
      expect(typeof counsellor.revenueInr).toBe("number");
      expect(typeof counsellor.conversationsAssignedCount).toBe("number");
      expect(typeof counsellor.leadsAssignedCount).toBe("number"); // from 1.6, carried through unchanged
    }
  });
});

describe("getAutomationRoi", () => {
  it("resolves without throwing; totals are the plain (non-deduplicated) sum of every workflow's own figures", async () => {
    const result = await getAutomationRoi(wideRange());
    const summedExecutions = result.workflows.reduce((sum, w) => sum + w.executions, 0);
    expect(result.totals.executions).toBe(summedExecutions);
    const summedRevenue = result.workflows.reduce((sum, w) => sum + w.revenueInfluencedInr, 0);
    expect(result.totals.revenueInfluencedInr).toBeCloseTo(summedRevenue, 5);
  });
});

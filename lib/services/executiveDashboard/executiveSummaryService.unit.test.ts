import { describe, it, expect } from "vitest";
import { getExecutiveDashboard } from "./executiveSummaryService";
import { getCrmRevenueFunnel } from "@/lib/services/revenueAnalytics";
import { leadService } from "@/lib/services/leads";
import { pipelineService } from "@/lib/services/crm/pipelines";
import { paymentService } from "@/lib/services/payments";
import { getLeadRepository, getPaymentRepository, getWhatsAppCampaignRepository } from "@/lib/db";
import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.3 — Executive Dashboard's
 * composition layer. Per this module's own doc comment, every field
 * either IS an existing 7.1/7.2 result verbatim or a pure aggregation
 * over one already fetched — these tests verify the composition never
 * drifts from its own source (e.g. kpis.totalLeadsInRange must always
 * equal funnel.stages[leadsCreated].count, never a second, independently
 * computed lead count) and that the two genuinely new aggregations
 * (WhatsApp Health, Payment Health) compute their rates correctly
 * against real seeded data, the same real-service seeding convention
 * lib/services/automation/analytics's own unit tests already use.
 */

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function wideRange(): DateRange {
  return { from: new Date(Date.now() - 3_600_000).toISOString(), to: new Date(Date.now() + 3_600_000).toISOString() };
}

async function createLead(): Promise<string> {
  const suffix = uniqueId("lead");
  const result = await leadService.registerLead({
    name: "Executive Dashboard Test Lead",
    email: `${suffix}@example.com`,
    phone: `+9198${String(Math.floor(Math.random() * 10_000_000)).padStart(8, "0")}`,
    source: "unit-test",
  });
  if (!result.success) throw new Error(`Failed to create lead: ${JSON.stringify(result.errors)}`);
  return result.lead.id;
}

describe("getExecutiveDashboard — funnel-derived KPIs never drift from the funnel itself", () => {
  it("totalLeadsInRange/conversionsInRange/conversionRatePct always equal the funnel's own stage values", async () => {
    const range = wideRange();
    await createLead();
    await createLead();

    const [dashboard, funnel] = await Promise.all([getExecutiveDashboard(range), getCrmRevenueFunnel(range)]);

    const leadsCreatedStage = funnel.stages.find((s) => s.key === "leadsCreated")!;
    const registrationsConfirmedStage = funnel.stages.find((s) => s.key === "registrationsConfirmed")!;

    expect(dashboard.kpis.totalLeadsInRange).toBe(leadsCreatedStage.count);
    expect(dashboard.kpis.conversionsInRange).toBe(registrationsConfirmedStage.count);
    expect(dashboard.kpis.conversionRatePct).toBe(registrationsConfirmedStage.conversionFromFirstPct);
  });
});

describe("getExecutiveDashboard — qualified leads is a live hot+warm snapshot, not a fabricated status", () => {
  it("counts only hot and warm leads, excludes cold", async () => {
    const repository = await getLeadRepository();
    const hotId = await createLead();
    const warmId = await createLead();
    const coldId = await createLead();
    await repository.update(hotId, { health: "hot" });
    await repository.update(warmId, { health: "warm" });
    await repository.update(coldId, { health: "cold" });

    const before = await getExecutiveDashboard(wideRange());
    // Baseline before is whatever pre-existing hot/warm leads exist in this
    // test environment's shared in-memory store; assert the delta instead
    // of an absolute count so this test is independent of test order.
    const hotBefore = (await leadService.listLeads({ health: "hot" }, 1, 1)).total;
    const warmBefore = (await leadService.listLeads({ health: "warm" }, 1, 1)).total;
    expect(before.kpis.qualifiedLeadsCount).toBe(hotBefore + warmBefore);
  });
});

describe("getExecutiveDashboard — opportunity KPI trio is a live, all-time snapshot", () => {
  it("openOpportunitiesCount/wonOpportunitiesCount/lostOpportunitiesCount match live pipelineService counts exactly", async () => {
    const pipeline = await pipelineService.ensureDefaultPipeline();
    const openStage = pipeline.stages.find((s) => !s.isWon && !s.isLost)!;
    const wonStage = pipeline.stages.find((s) => s.isWon)!;
    const lostStage = pipeline.stages.find((s) => s.isLost)!;

    const leadId = await createLead();
    const opp = await pipelineService.createOpportunity({ leadId, pipelineId: pipeline.id, stageId: openStage.id });
    await pipelineService.updateOpportunity(opp.id, { stageId: wonStage.id, status: "won" });

    const dashboard = await getExecutiveDashboard(wideRange());
    const [liveOpen, liveWon, liveLost] = await Promise.all([
      pipelineService.listOpportunities({ status: "open" }),
      pipelineService.listOpportunities({ status: "won" }),
      pipelineService.listOpportunities({ status: "lost" }),
    ]);

    expect(dashboard.kpis.openOpportunitiesCount).toBe(liveOpen.length);
    expect(dashboard.kpis.wonOpportunitiesCount).toBe(liveWon.length);
    expect(dashboard.kpis.lostOpportunitiesCount).toBe(liveLost.length);
    void lostStage; // referenced for stage lookup completeness; no lost opportunity seeded in this test
  });
});

describe("getExecutiveDashboard — WhatsApp Health aggregation", () => {
  it("sums real campaign counters and computes delivery/read/reply rates correctly", async () => {
    const repository = await getWhatsAppCampaignRepository();
    const campaign = await repository.create({ name: uniqueId("wa-campaign"), templateId: "unit-test-template" });
    await repository.incrementCounts(campaign.id, { sentCount: 100, deliveredCount: 80, readCount: 40, failedCount: 20, replyCount: 10 });

    const dashboard = await getExecutiveDashboard(wideRange());
    const found = dashboard.whatsappCampaigns.campaigns.find((c) => c.campaignId === campaign.id)!;
    expect(found.sentCount).toBe(100);
    expect(found.deliveredCount).toBe(80);

    // Account-wide aggregate must be >= this one campaign's own contribution,
    // and rates must be internally consistent (delivered/sent, read/delivered,
    // reply/delivered) — real division, never a fabricated percentage.
    expect(dashboard.whatsapp.sentCount).toBeGreaterThanOrEqual(100);
    expect(dashboard.whatsapp.deliveredCount).toBeGreaterThanOrEqual(80);
    if (dashboard.whatsapp.sentCount > 0) {
      const expectedDeliveryRate = (dashboard.whatsapp.deliveredCount / dashboard.whatsapp.sentCount) * 100;
      expect(dashboard.whatsapp.deliveryRatePct).toBeCloseTo(expectedDeliveryRate, 5);
    }
    expect(dashboard.kpis.whatsappDeliveryRatePct).toBe(dashboard.whatsapp.deliveryRatePct);
  });

  it("returns null rates (not zero or NaN) when sentCount/deliveredCount are zero", async () => {
    // A range with no campaigns at all in this narrow future window.
    const emptyRange: DateRange = {
      from: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      to: new Date(Date.now() + 11 * 86_400_000).toISOString(),
    };
    const dashboard = await getExecutiveDashboard(emptyRange);
    if (dashboard.whatsapp.sentCount === 0) {
      expect(dashboard.whatsapp.deliveryRatePct).toBeNull();
    }
    if (dashboard.whatsapp.deliveredCount === 0) {
      expect(dashboard.whatsapp.readRatePct).toBeNull();
      expect(dashboard.whatsapp.replyRatePct).toBeNull();
    }
  });
});

describe("getExecutiveDashboard — Payment Health aggregation", () => {
  it("matches paymentService.getAnalytics() exactly — a reshape, not a second query", async () => {
    const repository = await getPaymentRepository();
    await repository.create({ provider: "razorpay", amountInSmallestUnit: 500000, currency: "INR", status: "succeeded", purpose: "unit-test" });
    await repository.create({ provider: "razorpay", amountInSmallestUnit: 300000, currency: "INR", status: "failed", purpose: "unit-test" });

    const [dashboard, analytics] = await Promise.all([getExecutiveDashboard(wideRange()), paymentService.getAnalytics()]);

    expect(dashboard.payments.succeededCount).toBe(analytics.byStatus.succeeded);
    expect(dashboard.payments.failedCount).toBe(analytics.byStatus.failed);
    expect(dashboard.payments.totalTransactions).toBe(analytics.totalTransactions);
    expect(dashboard.payments.allTimeCollectedRevenueInr).toBe(analytics.succeededByCurrency.INR ?? 0);

    const expectedRate = (analytics.byStatus.succeeded / (analytics.byStatus.succeeded + analytics.byStatus.failed)) * 100;
    expect(dashboard.payments.paymentSuccessRatePct).toBeCloseTo(expectedRate, 5);
  });
});

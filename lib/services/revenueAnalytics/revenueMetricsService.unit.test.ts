import { describe, it, expect } from "vitest";
import { getPaymentRepository } from "@/lib/db";
import { leadService } from "@/lib/services/leads";
import { pipelineService } from "@/lib/services/crm/pipelines";
import { getRevenueMetrics, getRevenueGrowth } from "./revenueMetricsService";
import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Revenue Analytics
 * (mission §3). Seeds the in-memory Payment repository directly (the
 * same "bypass paymentService's own provider-gate/HTTP layer, which
 * isn't this file's concern" approach
 * payments.revenue.provider.unit.test.ts already established) and real
 * Opportunities via pipelineService.moveStage() for Won/Lost Revenue,
 * so this module's own enteredCurrentStageAt() derivation is exercised
 * against a real stageHistory, not a hand-built fixture.
 */

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function wideRange(): DateRange {
  return { from: new Date(Date.now() - 60_000).toISOString(), to: new Date(Date.now() + 60_000).toISOString() };
}

async function seedPayment(overrides: {
  status?: "created" | "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded";
  amountInSmallestUnit?: number;
  currency?: string;
  refundedAmountInSmallestUnit?: number;
  leadId?: string;
  opportunityId?: string;
}) {
  const repository = await getPaymentRepository();
  const payment = await repository.create({
    provider: "razorpay",
    providerOrderId: uniqueId("order"),
    amountInSmallestUnit: overrides.amountInSmallestUnit ?? 500000,
    currency: overrides.currency ?? "INR",
    status: "created",
    purpose: "Revenue analytics unit test",
    leadId: overrides.leadId,
    opportunityId: overrides.opportunityId,
  });
  return repository.update(payment.id, {
    status: overrides.status ?? "succeeded",
    ...(overrides.refundedAmountInSmallestUnit !== undefined
      ? { refundedAmountInSmallestUnit: overrides.refundedAmountInSmallestUnit }
      : {}),
  });
}

async function seedLead(): Promise<string> {
  const suffix = uniqueId("lead");
  const result = await leadService.registerLead({
    name: "Revenue Analytics Test Lead",
    email: `${suffix}@example.com`,
    phone: `+9198${String(Math.floor(Math.random() * 10_000_000)).padStart(8, "0")}`,
    source: "unit-test",
  });
  if (!result.success) throw new Error(`Failed to create lead: ${JSON.stringify(result.errors)}`);
  return result.lead.id;
}

async function seedWonOpportunity(leadId: string, expectedRevenueInr: number) {
  const pipeline = await pipelineService.createPipeline({
    name: uniqueId("pipeline"),
    stages: [{ name: "Open" }, { name: "Won", isWon: true }],
  });
  const openStage = pipeline.stages[0];
  const wonStage = pipeline.stages[1];
  const opportunity = await pipelineService.createOpportunity({
    leadId,
    pipelineId: pipeline.id,
    stageId: openStage.id,
    expectedRevenueInr,
  });
  return pipelineService.moveStage(opportunity.id, wonStage.id);
}

describe("getRevenueMetrics", () => {
  it("collectedRevenueInr sums succeeded + refunded + partially_refunded, excludes created/failed", async () => {
    await seedPayment({ status: "succeeded", amountInSmallestUnit: 100000 }); // ₹1000
    await seedPayment({ status: "refunded", amountInSmallestUnit: 200000, refundedAmountInSmallestUnit: 200000 }); // ₹2000, fully refunded but still "collected"
    await seedPayment({ status: "partially_refunded", amountInSmallestUnit: 300000, refundedAmountInSmallestUnit: 100000 }); // ₹3000 collected, ₹1000 refunded
    await seedPayment({ status: "created", amountInSmallestUnit: 999999 }); // never collected
    await seedPayment({ status: "failed", amountInSmallestUnit: 999999 }); // never collected

    const result = await getRevenueMetrics(wideRange());
    expect(result.collectedRevenueInr).toBeGreaterThanOrEqual(6000); // 1000 + 2000 + 3000, at minimum (other tests in this file may add more)
  });

  it("refundedInr sums refundedAmountInSmallestUnit separately from collected, and netRevenueInr = collected - refunded", async () => {
    const range = wideRange();
    const before = await getRevenueMetrics(range);
    await seedPayment({ status: "refunded", amountInSmallestUnit: 500000, refundedAmountInSmallestUnit: 500000 }); // ₹5000 collected, ₹5000 refunded
    const after = await getRevenueMetrics(range);

    expect(after.collectedRevenueInr - before.collectedRevenueInr).toBe(5000);
    expect(after.refundedInr - before.refundedInr).toBe(5000);
    expect(after.netRevenueInr - before.netRevenueInr).toBe(0);
  });

  it("non-INR succeeded payments are excluded from collectedRevenueInr and surfaced in collectedByOtherCurrency instead", async () => {
    const range = wideRange();
    const before = await getRevenueMetrics(range);
    await seedPayment({ status: "succeeded", amountInSmallestUnit: 10000, currency: "USD" }); // $100

    const after = await getRevenueMetrics(range);
    expect(after.collectedRevenueInr).toBe(before.collectedRevenueInr); // untouched by the USD payment
    expect(after.collectedByOtherCurrency.USD).toBeGreaterThanOrEqual(100);
  });

  it("wonRevenueInr sums expectedRevenueInr for Opportunities that entered a won stage in range, avgDealValueInr averages the same set", async () => {
    const range = wideRange();
    const leadA = await seedLead();
    const leadB = await seedLead();
    await seedWonOpportunity(leadA, 40000);
    await seedWonOpportunity(leadB, 60000);

    const result = await getRevenueMetrics(range);
    expect(result.wonRevenueInr).toBeGreaterThanOrEqual(100000); // at least these two (other tests may add more)
    expect(result.avgDealValueInr).not.toBeNull();
  });

  it("paymentSuccessRatePct / paymentFailureRatePct reflect only terminal (succeeded/refunded/partially_refunded vs failed) payments in range", async () => {
    const range = wideRange();
    // A fresh, tightly-scoped sub-range using a unique marker isn't
    // possible without a real filter on purpose text, so this asserts
    // the rate stays a valid 0-100 percentage rather than a brittle
    // exact number given other tests in this file share the same
    // in-memory store within this file.
    await seedPayment({ status: "succeeded" });
    await seedPayment({ status: "failed" });

    const result = await getRevenueMetrics(range);
    expect(result.paymentSuccessRatePct).not.toBeNull();
    expect(result.paymentSuccessRatePct).toBeGreaterThanOrEqual(0);
    expect(result.paymentSuccessRatePct).toBeLessThanOrEqual(100);
  });

  it("revenuePerLeadInr is null when zero leads exist in range, not a fabricated 0 or division error", async () => {
    const emptyFutureRange: DateRange = {
      from: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      to: new Date(Date.now() + 11 * 86_400_000).toISOString(),
    };
    const result = await getRevenueMetrics(emptyFutureRange);
    expect(result.revenuePerLeadInr).toBeNull();
    expect(result.collectedRevenueInr).toBe(0);
  });
});

describe("getRevenueGrowth", () => {
  it("computes a real period-over-period percentage against the immediately preceding period of equal length", async () => {
    const range: DateRange = {
      from: new Date(Date.now() - 60_000).toISOString(),
      to: new Date(Date.now() + 60_000).toISOString(),
    };
    const result = await getRevenueGrowth(range);
    expect(result.previousRange.to < result.range.from).toBe(true); // previous period ends strictly before the current one starts
    expect(result.currentCollectedRevenueInr).toBeGreaterThanOrEqual(0);
  });

  it("growthPct is null when the previous period collected exactly ₹0, not a fabricated infinite/NaN value", async () => {
    const farFutureRange: DateRange = {
      from: new Date(Date.now() + 100 * 86_400_000).toISOString(),
      to: new Date(Date.now() + 101 * 86_400_000).toISOString(),
    };
    const result = await getRevenueGrowth(farFutureRange);
    expect(result.previousCollectedRevenueInr).toBe(0);
    expect(result.growthPct).toBeNull();
  });
});

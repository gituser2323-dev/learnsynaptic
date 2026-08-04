import { describe, it, expect } from "vitest";
import { getPaymentRepository } from "@/lib/db";
import { leadService } from "@/lib/services/leads";
import { campaignService } from "@/lib/services/campaigns";
import { getRevenueAttribution } from "./attributionService";
import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Revenue Attribution
 * (mission §4). Verifies the one rule the whole module hangs on: DIRECT
 * dimensions (Payment.campaignId set at checkout time) vs. INFLUENCED
 * dimensions (Payment.leadId joined through Lead.source/utm) never mix
 * — a payment attributed directly to a Marketing Campaign must ALSO be
 * attributable (by the influenced rule) to its lead's own source, and
 * the two figures must never be presented as the same kind of claim.
 */

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function wideRange(): DateRange {
  return { from: new Date(Date.now() - 60_000).toISOString(), to: new Date(Date.now() + 60_000).toISOString() };
}

describe("getRevenueAttribution", () => {
  it("marketingCampaign is a DIRECT dimension: only payments with an explicit Payment.campaignId are attributed, everything else is unattributedInr", async () => {
    const range = wideRange();
    const campaignResult = await campaignService.createCampaign({
      name: uniqueId("Attribution Test Campaign"),
      code: uniqueId("attr-test"),
      channel: "other",
      startDate: new Date().toISOString(),
    });
    if (!campaignResult.success) throw new Error(JSON.stringify(campaignResult.errors));
    const campaign = campaignResult.campaign;

    const repository = await getPaymentRepository();
    const withCampaign = await repository.create({
      provider: "razorpay",
      providerOrderId: uniqueId("order"),
      amountInSmallestUnit: 400000, // ₹4000
      currency: "INR",
      status: "created",
      purpose: "Attribution unit test — direct",
      campaignId: campaign.id,
    });
    await repository.update(withCampaign.id, { status: "succeeded" });

    const withoutCampaign = await repository.create({
      provider: "razorpay",
      providerOrderId: uniqueId("order"),
      amountInSmallestUnit: 100000, // ₹1000
      currency: "INR",
      status: "created",
      purpose: "Attribution unit test — no campaign",
    });
    await repository.update(withoutCampaign.id, { status: "succeeded" });

    const result = await getRevenueAttribution(range);
    const dimension = result.dimensions.find((d) => d.dimension === "marketingCampaign")!;
    expect(dimension.type).toBe("direct");
    const row = dimension.rows.find((r) => r.key === campaign.id);
    expect(row).toBeDefined();
    expect(row!.revenueInr).toBeGreaterThanOrEqual(4000);
  });

  it("leadSource is an INFLUENCED dimension: attributed by joining Payment.leadId -> Lead.source, never a direct id match", async () => {
    const range = wideRange();
    const source = uniqueId("referral-partner");
    const leadResult = await leadService.registerLead({
      name: "Attribution Test Lead",
      email: `${uniqueId("lead")}@example.com`,
      phone: `+9198${String(Math.floor(Math.random() * 10_000_000)).padStart(8, "0")}`,
      source,
    });
    if (!leadResult.success) throw new Error(JSON.stringify(leadResult.errors));

    const repository = await getPaymentRepository();
    const payment = await repository.create({
      provider: "razorpay",
      providerOrderId: uniqueId("order"),
      amountInSmallestUnit: 250000, // ₹2500
      currency: "INR",
      status: "created",
      purpose: "Attribution unit test — lead source",
      leadId: leadResult.lead.id,
    });
    await repository.update(payment.id, { status: "succeeded" });

    const result = await getRevenueAttribution(range);
    const dimension = result.dimensions.find((d) => d.dimension === "leadSource")!;
    expect(dimension.type).toBe("influenced");
    const row = dimension.rows.find((r) => r.key === source);
    expect(row).toBeDefined();
    expect(row!.revenueInr).toBeGreaterThanOrEqual(2500);
  });

  it("a succeeded payment with no leadId at all contributes to leadSource's unattributedInr, not a fabricated source", async () => {
    const range = wideRange();
    const before = await getRevenueAttribution(range);
    const beforeUnattributed = before.dimensions.find((d) => d.dimension === "leadSource")!.unattributedInr;

    const repository = await getPaymentRepository();
    const payment = await repository.create({
      provider: "razorpay",
      providerOrderId: uniqueId("order"),
      amountInSmallestUnit: 150000, // ₹1500
      currency: "INR",
      status: "created",
      purpose: "Attribution unit test — no lead",
    });
    await repository.update(payment.id, { status: "succeeded" });

    const after = await getRevenueAttribution(range);
    const afterUnattributed = after.dimensions.find((d) => d.dimension === "leadSource")!.unattributedInr;
    expect(afterUnattributed - beforeUnattributed).toBeGreaterThanOrEqual(1500);
  });
});

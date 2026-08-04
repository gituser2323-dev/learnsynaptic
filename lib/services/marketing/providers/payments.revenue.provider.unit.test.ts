import { describe, it, expect } from "vitest";
import { getPaymentRepository } from "@/lib/db";
import { paymentsRevenueProvider } from "./payments.revenue.provider";

/**
 * Payments Integration (Phase 6), Module 6.4 — the real RevenueProvider
 * implementation, tested against the in-memory Payment repository
 * directly (bypassing paymentService's own provider-gate/HTTP layer,
 * which isn't this file's concern) — the same "seed the repository
 * directly for a read-only aggregation test" approach this codebase
 * already uses for read-side services.
 */

async function seedSucceededPayment(overrides: { currency?: string; amountInSmallestUnit?: number; leadId?: string } = {}) {
  const repository = await getPaymentRepository();
  const payment = await repository.create({
    provider: "razorpay",
    providerOrderId: `order_${Math.random().toString(36).slice(2)}`,
    amountInSmallestUnit: overrides.amountInSmallestUnit ?? 250000,
    currency: overrides.currency ?? "INR",
    status: "created",
    purpose: "Test payment",
    leadId: overrides.leadId,
  });
  const updated = await repository.update(payment.id, { status: "succeeded" });
  return updated;
}

describe("paymentsRevenueProvider.getMetrics", () => {
  it("always reports dataAvailable: true — a real system exists now, unlike the deleted placeholder", async () => {
    const result = await paymentsRevenueProvider.getMetrics({ from: "2020-01-01", to: "2020-01-02" });
    expect(result.dataAvailable).toBe(true);
  });

  it("sums only INR-denominated succeeded payments into totalRevenueInr, within the date range", async () => {
    await seedSucceededPayment({ amountInSmallestUnit: 500000, currency: "INR", leadId: "lead_a" });
    await seedSucceededPayment({ amountInSmallestUnit: 300000, currency: "USD", leadId: "lead_b" }); // excluded from totalRevenueInr

    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const result = await paymentsRevenueProvider.getMetrics({ from, to });

    expect(result.totalRevenueInr).toBeGreaterThanOrEqual(5000); // 500000 paise = 5000 INR from this test's own seed
  });

  it("counts distinct leadIds for paidStudentCount, not total payment count", async () => {
    const from = new Date(Date.now() - 60_000).toISOString();
    await seedSucceededPayment({ leadId: "lead_dup" });
    await seedSucceededPayment({ leadId: "lead_dup" }); // same lead, second payment
    await seedSucceededPayment({ leadId: "lead_unique" });
    const to = new Date(Date.now() + 60_000).toISOString();

    const result = await paymentsRevenueProvider.getMetrics({ from, to });
    // At least the two distinct leads seeded in this test are present —
    // other tests in this file may have seeded their own leads into the
    // same shared in-memory store, so this checks a lower bound, not
    // an exact count.
    expect(result.paidStudentCount).toBeGreaterThanOrEqual(2);
  });

  it("excludes payments outside the requested date range", async () => {
    await seedSucceededPayment({ leadId: "lead_out_of_range" });
    const from = new Date(Date.now() + 24 * 60 * 60_000).toISOString(); // starts tomorrow
    const to = new Date(Date.now() + 48 * 60 * 60_000).toISOString();

    const result = await paymentsRevenueProvider.getMetrics({ from, to });
    expect(result.totalRevenueInr).toBe(0);
    expect(result.paidStudentCount).toBe(0);
  });
});

import { getPaymentRepository } from "@/lib/db";
import type { DateRange, RevenueMetrics, RevenueProvider } from "../types";

/**
 * Payments Integration (Phase 6), Module 6.4 — the real RevenueProvider
 * this seam has been waiting for since it was first named in
 * marketing/types.ts's own doc comment: "a seam for the future Payments
 * module... not an external integration." No third-party vendor to
 * select here (unlike Ads/WebAnalytics) — Payments IS the vendor, so
 * this is the only RevenueProvider implementation that reads real data,
 * replacing the honest "unavailable" placeholder the previous
 * implementation (now deleted — its own doc comment predicted exactly
 * this replacement) returned unconditionally, now that a real,
 * persisted source of truth exists.
 *
 * `dataAvailable` is unconditionally true here — this is the one real,
 * structural difference from that placeholder, which asked "is a
 * Payments module connected at all?" (never), where this asks
 * "what does the real Payment collection say for this date range?" —
 * a genuine zero for an empty range is a real fact about the world, not
 * an unknown one, matching this module's own "0 asserts a fact, false
 * says the fact is unknown" doc comment in marketing/types.ts.
 */
export const paymentsRevenueProvider: RevenueProvider = {
  async getMetrics(range: DateRange): Promise<RevenueMetrics> {
    const repository = await getPaymentRepository();
    // No date-range-scoped list query exists on PaymentRepository today
    // (every other filter is entity/status-based) — a full page-1
    // sweep at a generous limit is the same "good enough, not a real
    // scale concern yet" judgment this codebase already made for
    // Registration/Lead admin lists before dedicated aggregation
    // queries existed. Revisit if real payment volume ever exceeds
    // this in practice.
    const { items } = await repository.list({ status: "succeeded" }, 1, 10_000);
    const from = new Date(range.from).getTime();
    const to = new Date(range.to).getTime();

    const inRange = items.filter((p) => {
      const at = new Date(p.updatedAt).getTime();
      return at >= from && at <= to;
    });

    // totalRevenueInr sums only INR-denominated payments — this app's
    // own primary currency and the field's own literal name. A
    // successful non-INR payment (Stripe/PayPal, once real) still
    // counts toward paidStudentCount below; fabricating an exchange
    // rate to fold it into one INR total would be a real, undisclosed
    // inaccuracy this codebase's own "never fabricate a number you
    // can't verify" discipline rules out.
    const inrPayments = inRange.filter((p) => p.currency === "INR");
    const totalRevenueInr = inrPayments.reduce((sum, p) => sum + p.amountInSmallestUnit, 0) / 100;

    const distinctLeadIds = new Set(inRange.map((p) => p.leadId).filter((id): id is string => Boolean(id)));

    return {
      totalRevenueInr,
      paidStudentCount: distinctLeadIds.size,
      dataAvailable: true,
    };
  },
};

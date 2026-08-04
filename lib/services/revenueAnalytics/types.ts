import type { DateRange } from "@/lib/services/marketing";

export type { DateRange };

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Revenue Analytics domain
 * layer.
 *
 * Deliberately reuses two ALREADY-EXISTING, non-competing business
 * definitions rather than inventing a third:
 *
 *  - "Collected"/"succeeded" revenue is Payment.status — real money a
 *    provider confirmed, the exact same status bucket
 *    paymentService.getAnalytics() already sums (succeeded +
 *    partially_refunded + refunded all count as money that WAS
 *    collected, even if later partly/fully refunded — refunds are
 *    surfaced separately, not netted silently out of "collected").
 *  - "Won"/"Lost"/"Pipeline"/"Expected" revenue is Opportunity's own
 *    sales-forecast field, expectedRevenueInr — the exact same figure
 *    pipelineAnalyticsService (module 7.1) already sums for its
 *    per-counsellor openPipelineValueInr/avgWonDealValueInr.
 *
 * These are genuinely two different real numbers in this app's
 * architecture (a forecast vs. actual cash), not a Total Revenue vs.
 * Collected Revenue split invented for this module — an Opportunity can
 * be "won" with no Payment yet (an offline/manual payment arrangement),
 * and a Payment can succeed with no linked Opportunity at all (a direct
 * checkout link). Reporting both, clearly labeled, is the honest
 * answer; silently picking one and calling it "Total Revenue" would
 * hide which kind of number a business owner is looking at.
 *
 * Currency: every INR figure here excludes non-INR succeeded Payments
 * (Stripe can settle in USD) — the same "one flat total would silently
 * sum incompatible units" reasoning paymentService.getAnalytics()'s own
 * byCurrency split already documents. See succeededByCurrencyInr's own
 * doc for the non-INR disclosure.
 */
export interface RevenueMetrics {
  range: DateRange;
  /** Gross succeeded-Payment amount, INR only, within range — see this
   *  file's own module doc. Includes payments later partially/fully
   *  refunded (see refundedInr — collected and refunded are reported
   *  separately, never netted silently). */
  collectedRevenueInr: number;
  /** collectedRevenueInr − refundedInr. */
  netRevenueInr: number;
  refundedInr: number;
  /** Succeeded-Payment revenue in every OTHER currency this deployment
   *  has collected in, keyed by currency code — disclosed rather than
   *  silently dropped or force-summed into collectedRevenueInr. Empty
   *  object if every succeeded payment in range was INR. */
  collectedByOtherCurrency: Record<string, number>;
  /** Sum of expectedRevenueInr across currently-OPEN Opportunities — a
   *  live snapshot ("what's in the pipeline right now"), deliberately
   *  NOT scoped to `range` the way Won/Lost Revenue are (an open deal's
   *  existence isn't a "this happened in this period" event the way a
   *  win/loss is). Same figure as pipelineValueInr — see that field's
   *  own doc on why they're aliases, not two different numbers. */
  expectedRevenueInr: number;
  /** Alias of expectedRevenueInr. The mission's own vocabulary names
   *  both "Expected Revenue" and "Pipeline Value" — in this
   *  architecture's data model they are the same figure (sum of open
   *  Opportunities' own forecast field), so this is a genuine alias,
   *  not a second, differently-computed number pretending to be
   *  distinct. */
  pipelineValueInr: number;
  /** Sum of expectedRevenueInr across Opportunities that entered a
   *  "won" stage within range (by Opportunity.stageHistory's own entry
   *  for the opportunity's current stage — the real transition
   *  timestamp, not createdAt/updatedAt). */
  wonRevenueInr: number;
  /** Same, for Opportunities that entered a "lost" stage within range. */
  lostRevenueInr: number;
  /** Average expectedRevenueInr across Opportunities won within range.
   *  Null if none won in range. */
  avgDealValueInr: number | null;
  /** collectedRevenueInr / total Leads created in range. Null if zero
   *  leads in range (undefined, not a fabricated 0). */
  revenuePerLeadInr: number | null;
  /** collectedRevenueInr / Registration count in range — "conversion"
   *  reuses the EXACT existing definition
   *  lib/services/marketing/funnels.ts's ConversionFunnel already uses
   *  (every Registration, not only "confirmed" ones), for consistency
   *  with that already-shipped funnel rather than a stricter
   *  module-local redefinition. Null if zero conversions in range. */
  revenuePerConversionInr: number | null;
  /** succeeded / (succeeded + failed) Payment count in range, 0–100.
   *  Null if no payment attempt in range reached either terminal
   *  state. */
  paymentSuccessRatePct: number | null;
  paymentFailureRatePct: number | null;
  paymentStatusCounts: Record<string, number>;
}

export interface RevenueTrendPoint {
  /** YYYY-MM-DD, IST calendar day — see dateRanges.ts's own module doc
   *  on why IST, not UTC. */
  date: string;
  collectedRevenueInr: number;
}

export interface RevenueGrowth {
  range: DateRange;
  /** The immediately-preceding period of equal day-length — e.g. range
   *  2026-07-01..2026-07-31 compares against 2026-06-01..2026-06-30. */
  previousRange: DateRange;
  currentCollectedRevenueInr: number;
  previousCollectedRevenueInr: number;
  /** (current − previous) / previous × 100. Null if the previous period
   *  collected exactly ₹0 — a percentage change from zero is undefined,
   *  not infinite or fabricated. */
  growthPct: number | null;
}

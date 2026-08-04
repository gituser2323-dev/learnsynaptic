import { getPaymentRepository } from "@/lib/db";
import { leadService } from "@/lib/services/leads";
import { registrationService } from "@/lib/services/registrations";
import { pipelineService } from "@/lib/services/crm/pipelines";
import type { Opportunity } from "@/lib/services/crm/pipelines";
import type { Payment, PaymentStatus } from "@/lib/services/payments";
import type { DateRange, RevenueGrowth, RevenueMetrics, RevenueTrendPoint } from "./types";

/** Dashboard-scale read cap — see automationAnalyticsService.ts's own
 *  doc comment for why this is a deliberate, disclosed tradeoff rather
 *  than a real aggregation pipeline at this stage. */
const MAX_PAYMENTS_FOR_ANALYTICS = 10_000;

function inRange(iso: string, range: DateRange): boolean {
  return iso >= range.from && iso <= range.to;
}

/** The real timestamp an Opportunity entered its CURRENT stage — from
 *  its own stageHistory, the same source pipelineAnalyticsService's
 *  buildPipelineFunnel() already reads. Falls back to updatedAt for an
 *  opportunity created before stageHistory existed and never backfilled
 *  (see scripts/backfillOpportunityStageHistory.ts's own disclosed
 *  "current stage only" limitation). */
function enteredCurrentStageAt(opportunity: Opportunity): string {
  const entry = [...opportunity.stageHistory].reverse().find((e) => e.stageId === opportunity.stageId);
  return entry?.enteredAt ?? opportunity.updatedAt;
}

const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = ["succeeded", "failed", "partially_refunded", "refunded"];

function sumInr(payments: Payment[]): number {
  return payments.reduce((sum, p) => sum + p.amountInSmallestUnit / 100, 0);
}

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Revenue Analytics
 * (mission §3). See ./types.ts's own module doc for why Collected
 * (Payment-derived) and Won/Lost/Pipeline (Opportunity-derived) are two
 * genuinely different, non-competing numbers.
 */
export async function getRevenueMetrics(range: DateRange): Promise<RevenueMetrics> {
  const [paymentsPage, allOpportunities, leadsInRangeResult, registrationAnalytics] = await Promise.all([
    (await getPaymentRepository()).list({ createdAfter: range.from, createdBefore: range.to }, 1, MAX_PAYMENTS_FOR_ANALYTICS),
    pipelineService.listOpportunities({}),
    leadService.listLeads({ createdAfter: range.from, createdBefore: range.to }, 1, 1),
    registrationService.getAnalytics(),
  ]);

  const paymentsInRange = paymentsPage.items;
  const succeededOrRefunded = paymentsInRange.filter((p) => p.status === "succeeded" || p.status === "partially_refunded" || p.status === "refunded");
  const succeededInr = succeededOrRefunded.filter((p) => p.currency === "INR");
  const succeededOther = succeededOrRefunded.filter((p) => p.currency !== "INR");

  const collectedRevenueInr = sumInr(succeededInr);
  const refundedInr = paymentsInRange
    .filter((p) => p.currency === "INR")
    .reduce((sum, p) => sum + p.refundedAmountInSmallestUnit / 100, 0);

  const collectedByOtherCurrency: Record<string, number> = {};
  for (const p of succeededOther) {
    collectedByOtherCurrency[p.currency] = (collectedByOtherCurrency[p.currency] ?? 0) + p.amountInSmallestUnit / 100;
  }

  const openOpportunities = allOpportunities.filter((o) => o.status === "open");
  const expectedRevenueInr = openOpportunities.reduce((sum, o) => sum + (o.expectedRevenueInr ?? 0), 0);

  const wonInRange = allOpportunities.filter((o) => o.status === "won" && inRange(enteredCurrentStageAt(o), range));
  const lostInRange = allOpportunities.filter((o) => o.status === "lost" && inRange(enteredCurrentStageAt(o), range));
  const wonRevenueInr = wonInRange.reduce((sum, o) => sum + (o.expectedRevenueInr ?? 0), 0);
  const lostRevenueInr = lostInRange.reduce((sum, o) => sum + (o.expectedRevenueInr ?? 0), 0);
  const wonValues = wonInRange.map((o) => o.expectedRevenueInr).filter((v): v is number => v !== undefined);
  const avgDealValueInr = wonValues.length === 0 ? null : wonValues.reduce((sum, v) => sum + v, 0) / wonValues.length;

  const leadsInRange = leadsInRangeResult.total;
  const conversionsInRange = registrationAnalytics.totalRegistrations;

  const terminal = paymentsInRange.filter((p) => TERMINAL_PAYMENT_STATUSES.includes(p.status));
  const succeededCount = terminal.filter((p) => p.status === "succeeded" || p.status === "partially_refunded" || p.status === "refunded").length;
  const failedCount = terminal.filter((p) => p.status === "failed").length;
  const paymentStatusCounts: Record<string, number> = {};
  for (const p of paymentsInRange) paymentStatusCounts[p.status] = (paymentStatusCounts[p.status] ?? 0) + 1;

  return {
    range,
    collectedRevenueInr,
    netRevenueInr: collectedRevenueInr - refundedInr,
    refundedInr,
    collectedByOtherCurrency,
    expectedRevenueInr,
    pipelineValueInr: expectedRevenueInr,
    wonRevenueInr,
    lostRevenueInr,
    avgDealValueInr,
    revenuePerLeadInr: leadsInRange === 0 ? null : collectedRevenueInr / leadsInRange,
    revenuePerConversionInr: conversionsInRange === 0 ? null : collectedRevenueInr / conversionsInRange,
    paymentSuccessRatePct: succeededCount + failedCount === 0 ? null : (succeededCount / (succeededCount + failedCount)) * 100,
    paymentFailureRatePct: succeededCount + failedCount === 0 ? null : (failedCount / (succeededCount + failedCount)) * 100,
    paymentStatusCounts,
  };
}

function shiftedPreviousRange(range: DateRange): DateRange {
  const fromMs = Date.parse(range.from);
  const toMs = Date.parse(range.to);
  const spanMs = toMs - fromMs;
  return {
    from: new Date(fromMs - spanMs - 86_400_000).toISOString(),
    to: new Date(fromMs - 86_400_000).toISOString(),
  };
}

/** Enterprise Analytics (Phase 7), module 7.2 — Revenue Growth (mission
 *  §3): period-over-period collected-revenue comparison against the
 *  immediately-preceding period of equal length. A separate function
 *  (not folded into getRevenueMetrics) since it needs two full revenue
 *  computations, and most callers of getRevenueMetrics don't need the
 *  second one. */
export async function getRevenueGrowth(range: DateRange): Promise<RevenueGrowth> {
  const previousRange = shiftedPreviousRange(range);
  const [current, previous] = await Promise.all([getRevenueMetrics(range), getRevenueMetrics(previousRange)]);

  const growthPct =
    previous.collectedRevenueInr === 0
      ? null
      : ((current.collectedRevenueInr - previous.collectedRevenueInr) / previous.collectedRevenueInr) * 100;

  return {
    range,
    previousRange,
    currentCollectedRevenueInr: current.collectedRevenueInr,
    previousCollectedRevenueInr: previous.collectedRevenueInr,
    growthPct,
  };
}

const MAX_TREND_DAYS = 92;

function dayBucket(iso: string): string {
  return iso.slice(0, 10);
}

/** Enterprise Analytics (Phase 7), module 7.3 — Executive Dashboard's
 *  own "Revenue trend" requirement (mission's own Revenue Overview
 *  section). Added here, in 7.2's own revenueMetricsService, rather
 *  than as new logic inside 7.3 — this is the one calculation 7.2's own
 *  scope didn't need (its own page shows KPIs, not a day-by-day
 *  series) but that legitimately belongs to Payment-derived revenue's
 *  one real owner file, the same day-bucketing shape
 *  automationAnalyticsService.ts's own buildTrend() already
 *  established for execution counts. */
export async function getRevenueTrend(range: DateRange): Promise<RevenueTrendPoint[]> {
  const fromDayMs = Date.parse(`${dayBucket(range.from)}T00:00:00.000Z`);
  const toDayMs = Date.parse(`${dayBucket(range.to)}T00:00:00.000Z`);
  const spanDays = Math.round((toDayMs - fromDayMs) / 86_400_000) + 1;
  if (spanDays > MAX_TREND_DAYS || spanDays < 1) return [];

  const paymentsPage = await (await getPaymentRepository()).list(
    { createdAfter: range.from, createdBefore: range.to },
    1,
    MAX_PAYMENTS_FOR_ANALYTICS,
  );
  const succeeded = paymentsPage.items.filter(
    (p) => p.currency === "INR" && (p.status === "succeeded" || p.status === "partially_refunded" || p.status === "refunded"),
  );

  const byDay = new Map<string, number>();
  for (let i = 0; i < spanDays; i++) {
    byDay.set(new Date(fromDayMs + i * 86_400_000).toISOString().slice(0, 10), 0);
  }
  for (const p of succeeded) {
    const day = dayBucket(p.createdAt);
    byDay.set(day, (byDay.get(day) ?? 0) + p.amountInSmallestUnit / 100);
  }

  return [...byDay.entries()].map(([date, collectedRevenueInr]) => ({ date, collectedRevenueInr }));
}

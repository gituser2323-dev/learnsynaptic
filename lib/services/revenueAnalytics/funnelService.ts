import { getPaymentRepository } from "@/lib/db";
import { leadService } from "@/lib/services/leads";
import { registrationService } from "@/lib/services/registrations";
import { pipelineService } from "@/lib/services/crm/pipelines";
import type { Opportunity } from "@/lib/services/crm/pipelines";
import type { CrmFunnelResult, CrmFunnelStage, CrmFunnelStageKey } from "./funnelTypes";
import type { DateRange } from "./types";

const MAX_PAYMENTS_FOR_ANALYTICS = 10_000;

function inRange(iso: string, range: DateRange): boolean {
  return iso >= range.from && iso <= range.to;
}

function hoursBetween(earlierIso: string, laterIso: string): number {
  return (new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / 3_600_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Same real-transition-timestamp logic as
 *  revenueMetricsService.ts's own enteredCurrentStageAt — duplicated
 *  rather than imported since it's a small pure helper and the two
 *  files are otherwise independent reads (the "three similar lines"
 *  judgment call, not a shared abstraction worth the coupling). */
function enteredCurrentStageAt(opportunity: Opportunity): string {
  const entry = [...opportunity.stageHistory].reverse().find((e) => e.stageId === opportunity.stageId);
  return entry?.enteredAt ?? opportunity.updatedAt;
}

function buildStage(
  key: CrmFunnelStageKey,
  label: string,
  count: number,
  firstStageCount: number,
  previousStageCount: number | null,
  revenueInr: number | null,
  avgTimeInStageHours: number | null,
): CrmFunnelStage {
  return {
    key,
    label,
    count,
    conversionFromFirstPct: firstStageCount === 0 ? null : (count / firstStageCount) * 100,
    conversionFromPreviousPct: previousStageCount === null || previousStageCount === 0 ? null : (count / previousStageCount) * 100,
    dropOffFromPreviousPct:
      previousStageCount === null || previousStageCount === 0 ? null : Math.max(0, 100 - (count / previousStageCount) * 100),
    revenueInr,
    avgTimeInStageHours,
  };
}

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Funnel Analytics (mission
 * §5). See ./funnelTypes.ts's own module doc for the real stage chain
 * this uses and why it departs from the mission's own suggested labels.
 */
export async function getCrmRevenueFunnel(range: DateRange): Promise<CrmFunnelResult> {
  const [leadsInRangeResult, allOpportunities, paymentsPage, confirmedRegistrationsResult] = await Promise.all([
    leadService.listLeads({ createdAfter: range.from, createdBefore: range.to }, 1, 1),
    pipelineService.listOpportunities({}),
    (await getPaymentRepository()).list({ status: "succeeded", createdAfter: range.from, createdBefore: range.to }, 1, MAX_PAYMENTS_FOR_ANALYTICS),
    registrationService.listRegistrations({ status: "confirmed", createdAfter: range.from, createdBefore: range.to }, 1, MAX_PAYMENTS_FOR_ANALYTICS),
  ]);

  const leadsCreatedCount = leadsInRangeResult.total;

  const opportunitiesCreatedInRange = allOpportunities.filter((o) => inRange(o.createdAt, range));
  const opportunitiesWonInRange = allOpportunities.filter((o) => o.status === "won" && inRange(enteredCurrentStageAt(o), range));
  const wonRevenueInr = opportunitiesWonInRange.reduce((sum, o) => sum + (o.expectedRevenueInr ?? 0), 0);

  // Lead -> Opportunity: real join via Opportunity.leadId.
  const uniqueLeadIds = [...new Set(opportunitiesCreatedInRange.map((o) => o.leadId))];
  const leads = await Promise.all(uniqueLeadIds.map((id) => leadService.getLead(id)));
  const leadCreatedAtById = new Map(uniqueLeadIds.map((id, i) => [id, leads[i]?.createdAt]));
  const leadToOpportunityHours = opportunitiesCreatedInRange
    .map((o) => {
      const leadCreatedAt = leadCreatedAtById.get(o.leadId);
      return leadCreatedAt ? hoursBetween(leadCreatedAt, o.createdAt) : null;
    })
    .filter((h): h is number => h !== null);

  // Opportunity created -> won: both timestamps live on the same row.
  const openToWonHours = opportunitiesWonInRange.map((o) => hoursBetween(o.createdAt, enteredCurrentStageAt(o)));

  const succeededPayments = paymentsPage.items.filter((p) => p.currency === "INR");
  const collectedRevenueInr = succeededPayments.reduce((sum, p) => sum + p.amountInSmallestUnit / 100, 0);

  // Won -> Payment succeeded: real join via Payment.opportunityId, only
  // where that opportunity is resolvable AND itself won (a payment for
  // a still-open or lost opportunity isn't this transition).
  const wonOpportunityById = new Map(allOpportunities.filter((o) => o.status === "won").map((o) => [o.id, o]));
  const wonToPaidHours = succeededPayments
    .map((p) => {
      const opportunity = p.opportunityId ? wonOpportunityById.get(p.opportunityId) : undefined;
      return opportunity ? hoursBetween(enteredCurrentStageAt(opportunity), p.createdAt) : null;
    })
    .filter((h): h is number => h !== null);

  const confirmedRegistrationsCount = confirmedRegistrationsResult.total;

  // Payment succeeded -> Registration confirmed: real join via
  // Payment.registrationId (only set when the checkout was created
  // against a specific Registration — not every payment carries one).
  // updatedAt stands in for "confirmed at" — see funnelTypes.ts's own
  // disclosed approximation note (Registration has no dedicated
  // confirmedAt field, the same gap Opportunity had before
  // stageHistory existed).
  const paymentByRegistrationId = new Map(succeededPayments.filter((p) => p.registrationId).map((p) => [p.registrationId!, p]));
  const paidToEnrolledHours = confirmedRegistrationsResult.items
    .map((registration) => {
      const payment = paymentByRegistrationId.get(registration.id);
      return payment ? hoursBetween(payment.createdAt, registration.updatedAt) : null;
    })
    .filter((h): h is number => h !== null);

  const stages: CrmFunnelStage[] = [
    buildStage("leadsCreated", "Leads", leadsCreatedCount, leadsCreatedCount, null, null, null),
    buildStage(
      "opportunitiesCreated",
      "Opportunity Created",
      opportunitiesCreatedInRange.length,
      leadsCreatedCount,
      leadsCreatedCount,
      null,
      average(leadToOpportunityHours),
    ),
    buildStage(
      "opportunitiesWon",
      "Opportunity Won",
      opportunitiesWonInRange.length,
      leadsCreatedCount,
      opportunitiesCreatedInRange.length,
      wonRevenueInr,
      average(openToWonHours),
    ),
    buildStage(
      "paymentsSucceeded",
      "Payment Succeeded",
      succeededPayments.length,
      leadsCreatedCount,
      opportunitiesWonInRange.length,
      collectedRevenueInr,
      average(wonToPaidHours),
    ),
    buildStage(
      "registrationsConfirmed",
      "Enrolled",
      confirmedRegistrationsCount,
      leadsCreatedCount,
      succeededPayments.length,
      // Revenue already credited at the Payment Succeeded stage above —
      // repeating it here would double-count the same money against
      // two funnel stages.
      null,
      average(paidToEnrolledHours),
    ),
  ];

  return { range, stages };
}

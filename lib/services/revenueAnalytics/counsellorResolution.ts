import { leadService } from "@/lib/services/leads";
import type { Payment } from "@/lib/services/payments";
import type { Opportunity } from "@/lib/services/crm/pipelines";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — the same
 * "Opportunity.ownerId, falling back to the parent Lead's
 * assignedCounsellorId" attribution rule pipelineAnalyticsService
 * (module 7.1) already established for counsellor ownership — reused
 * here verbatim rather than redefined, so a payment's counsellor
 * attribution always agrees with 7.1's own opportunity ownership view.
 *
 * Batches Lead lookups by unique leadId, the same shape 7.1's own
 * resolveOwnerAttribution() uses.
 */
export async function resolveCounsellorForPayments(
  payments: Payment[],
  opportunityById: Map<string, Opportunity>,
): Promise<Map<string, string | undefined>> {
  const needsLeadLookup = new Set<string>();
  for (const payment of payments) {
    const opportunity = payment.opportunityId ? opportunityById.get(payment.opportunityId) : undefined;
    if (!opportunity?.ownerId && payment.leadId) needsLeadLookup.add(payment.leadId);
  }

  const leadIds = [...needsLeadLookup];
  const leads = await Promise.all(leadIds.map((leadId) => leadService.getLead(leadId)));
  const counsellorIdByLeadId = new Map(leadIds.map((leadId, i) => [leadId, leads[i]?.assignedCounsellorId]));

  const result = new Map<string, string | undefined>();
  for (const payment of payments) {
    const opportunity = payment.opportunityId ? opportunityById.get(payment.opportunityId) : undefined;
    const counsellorId = opportunity?.ownerId ?? (payment.leadId ? counsellorIdByLeadId.get(payment.leadId) : undefined);
    result.set(payment.id, counsellorId);
  }
  return result;
}

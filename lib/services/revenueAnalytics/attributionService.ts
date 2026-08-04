import { getPaymentRepository, getWhatsAppCampaignRepository, getMessageRepository } from "@/lib/db";
import { leadService } from "@/lib/services/leads";
import { campaignService } from "@/lib/services/campaigns";
import { pipelineService } from "@/lib/services/crm/pipelines";
import type { Opportunity, Pipeline } from "@/lib/services/crm/pipelines";
import type { Lead } from "@/lib/services/leads";
import type { Payment } from "@/lib/services/payments";
import { authService } from "@/lib/services/auth";
import { resolveCounsellorForPayments } from "./counsellorResolution";
import type { AttributionDimension, AttributionRow, RevenueAttributionResult } from "./attributionTypes";
import type { DateRange } from "./types";

const MAX_PAYMENTS_FOR_ANALYTICS = 10_000;

function toInr(payment: Payment): number {
  return payment.amountInSmallestUnit / 100;
}

function buildDimension(
  dimension: AttributionDimension["dimension"],
  type: AttributionDimension["type"],
  keyed: Map<string, { label: string; revenueInr: number; paymentCount: number }>,
  unattributedInr: number,
): AttributionDimension {
  const rows: AttributionRow[] = [...keyed.entries()]
    .map(([key, v]) => ({ key, label: v.label, revenueInr: v.revenueInr, paymentCount: v.paymentCount }))
    .sort((a, b) => b.revenueInr - a.revenueInr);
  return { dimension, type, rows, unattributedInr };
}

function addTo(
  keyed: Map<string, { label: string; revenueInr: number; paymentCount: number }>,
  key: string,
  label: string,
  amountInr: number,
): void {
  const existing = keyed.get(key) ?? { label, revenueInr: 0, paymentCount: 0 };
  existing.revenueInr += amountInr;
  existing.paymentCount += 1;
  keyed.set(key, existing);
}

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Revenue Attribution
 * (mission §4). See ./attributionTypes.ts's own module doc for the
 * DIRECT-vs-INFLUENCED rule. Automation Workflow attribution is
 * deliberately NOT computed here — it's already computed once, more
 * precisely (per-run join, not just per-lead), by
 * lib/services/automation/analytics/workflowPerformanceService.ts;
 * getRevenueAttribution's own caller (the API route) merges that
 * result in rather than this file recomputing the same join.
 */
export async function getRevenueAttribution(range: DateRange): Promise<RevenueAttributionResult> {
  const [paymentsPage, allOpportunities, pipelines] = await Promise.all([
    (await getPaymentRepository()).list({ status: "succeeded", createdAfter: range.from, createdBefore: range.to }, 1, MAX_PAYMENTS_FOR_ANALYTICS),
    pipelineService.listOpportunities({}),
    pipelineService.listPipelines(),
  ]);

  const payments = paymentsPage.items.filter((p) => p.currency === "INR");
  const totalCollectedRevenueInr = payments.reduce((sum, p) => sum + toInr(p), 0);

  const opportunityById = new Map<string, Opportunity>(allOpportunities.map((o) => [o.id, o]));
  const pipelineById = new Map<string, Pipeline>(pipelines.map((p) => [p.id, p]));

  const uniqueLeadIds = [...new Set(payments.map((p) => p.leadId).filter((id): id is string => !!id))];
  const leads = await Promise.all(uniqueLeadIds.map((id) => leadService.getLead(id)));
  const leadById = new Map<string, Lead>(leads.filter((l): l is Lead => l !== null).map((l) => [l.id, l]));

  const uniqueCampaignIds = [...new Set(payments.map((p) => p.campaignId).filter((id): id is string => !!id))];
  const campaigns = await Promise.all(uniqueCampaignIds.map((id) => campaignService.getCampaignById(id)));
  const campaignById = new Map(campaigns.filter((c) => c !== null).map((c) => [c!.id, c!]));

  // Marketing Campaign — DIRECT (Payment.campaignId is set at
  // checkout-creation time, never inferred).
  const marketingCampaignKeyed = new Map<string, { label: string; revenueInr: number; paymentCount: number }>();
  let marketingCampaignUnattributed = 0;
  for (const p of payments) {
    const campaign = p.campaignId ? campaignById.get(p.campaignId) : undefined;
    if (campaign) addTo(marketingCampaignKeyed, campaign.id, campaign.name, toInr(p));
    else marketingCampaignUnattributed += toInr(p);
  }

  // Pipeline — DIRECT (via Payment.opportunityId -> Opportunity.pipelineId).
  const pipelineKeyed = new Map<string, { label: string; revenueInr: number; paymentCount: number }>();
  let pipelineUnattributed = 0;
  for (const p of payments) {
    const opportunity = p.opportunityId ? opportunityById.get(p.opportunityId) : undefined;
    const pipeline = opportunity ? pipelineById.get(opportunity.pipelineId) : undefined;
    if (pipeline) addTo(pipelineKeyed, pipeline.id, pipeline.name, toInr(p));
    else pipelineUnattributed += toInr(p);
  }

  // Lead Source / UTM / Program — INFLUENCED (joined through leadId).
  const leadSourceKeyed = new Map<string, { label: string; revenueInr: number; paymentCount: number }>();
  const utmSourceKeyed = new Map<string, { label: string; revenueInr: number; paymentCount: number }>();
  const utmMediumKeyed = new Map<string, { label: string; revenueInr: number; paymentCount: number }>();
  const utmCampaignKeyed = new Map<string, { label: string; revenueInr: number; paymentCount: number }>();
  const programKeyed = new Map<string, { label: string; revenueInr: number; paymentCount: number }>();
  let leadSourceUnattributed = 0;
  let utmSourceUnattributed = 0;
  let utmMediumUnattributed = 0;
  let utmCampaignUnattributed = 0;
  let programUnattributed = 0;

  for (const p of payments) {
    const lead = p.leadId ? leadById.get(p.leadId) : undefined;
    const amount = toInr(p);
    if (lead) addTo(leadSourceKeyed, lead.source, lead.source, amount);
    else leadSourceUnattributed += amount;

    if (lead?.utm?.utmSource) addTo(utmSourceKeyed, lead.utm.utmSource, lead.utm.utmSource, amount);
    else utmSourceUnattributed += amount;

    if (lead?.utm?.utmMedium) addTo(utmMediumKeyed, lead.utm.utmMedium, lead.utm.utmMedium, amount);
    else utmMediumUnattributed += amount;

    if (lead?.utm?.utmCampaign) addTo(utmCampaignKeyed, lead.utm.utmCampaign, lead.utm.utmCampaign, amount);
    else utmCampaignUnattributed += amount;

    if (lead?.program) addTo(programKeyed, lead.program, lead.program, amount);
    else programUnattributed += amount;
  }

  // Counsellor — same rule 7.1 uses (Opportunity.ownerId, falling back
  // to the Lead's assignedCounsellorId). INFLUENCED for the fallback
  // path, but reported as one dimension — a payment linked to an
  // Opportunity with a real ownerId is about as direct as this app's
  // data model gets for "who gets credit," so splitting it into two
  // dimensions would be more confusing than useful.
  const counsellorByPaymentId = await resolveCounsellorForPayments(payments, opportunityById);
  const staff = await authService.listActiveStaff();
  const staffNameById = new Map(staff.map((u) => [u.id, u.name ?? u.email]));
  const counsellorKeyed = new Map<string, { label: string; revenueInr: number; paymentCount: number }>();
  let counsellorUnattributed = 0;
  for (const p of payments) {
    const counsellorId = counsellorByPaymentId.get(p.id);
    if (counsellorId) addTo(counsellorKeyed, counsellorId, staffNameById.get(counsellorId) ?? "Former staff member", toInr(p));
    else counsellorUnattributed += toInr(p);
  }

  // WhatsApp Campaign — INFLUENCED, "last touch before payment": the
  // most recent WhatsApp campaign Message sent to this lead at or
  // before the payment's own createdAt. A real, disclosed
  // simplification of multi-touch attribution — this app tracks no
  // click/open-to-conversion path beyond "a campaign messaged this
  // lead," so crediting the closest-in-time campaign is the honest
  // maximum this data supports.
  const whatsappCampaignKeyed = new Map<string, { label: string; revenueInr: number; paymentCount: number }>();
  let whatsappCampaignUnattributed = 0;
  const messageRepository = await getMessageRepository();
  const whatsappCampaignRepository = await getWhatsAppCampaignRepository();
  const whatsappCampaignNameCache = new Map<string, string>();
  for (const p of payments) {
    if (!p.leadId) {
      whatsappCampaignUnattributed += toInr(p);
      continue;
    }
    const priorMessages = await messageRepository.list({ leadId: p.leadId, createdBefore: p.createdAt }, 1, 200);
    const withCampaign = priorMessages.items.filter((m) => m.campaignId);
    const lastTouch = withCampaign.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!lastTouch?.campaignId) {
      whatsappCampaignUnattributed += toInr(p);
      continue;
    }
    let name = whatsappCampaignNameCache.get(lastTouch.campaignId);
    if (!name) {
      const campaign = await whatsappCampaignRepository.findById(lastTouch.campaignId);
      name = campaign?.name ?? "Deleted campaign";
      whatsappCampaignNameCache.set(lastTouch.campaignId, name);
    }
    addTo(whatsappCampaignKeyed, lastTouch.campaignId, name, toInr(p));
  }

  return {
    range,
    totalCollectedRevenueInr,
    dimensions: [
      buildDimension("marketingCampaign", "direct", marketingCampaignKeyed, marketingCampaignUnattributed),
      buildDimension("pipeline", "direct", pipelineKeyed, pipelineUnattributed),
      buildDimension("leadSource", "influenced", leadSourceKeyed, leadSourceUnattributed),
      buildDimension("utmSource", "influenced", utmSourceKeyed, utmSourceUnattributed),
      buildDimension("utmMedium", "influenced", utmMediumKeyed, utmMediumUnattributed),
      buildDimension("utmCampaign", "influenced", utmCampaignKeyed, utmCampaignUnattributed),
      buildDimension("program", "influenced", programKeyed, programUnattributed),
      buildDimension("counsellor", "influenced", counsellorKeyed, counsellorUnattributed),
      buildDimension("whatsappCampaign", "influenced", whatsappCampaignKeyed, whatsappCampaignUnattributed),
    ],
  };
}

import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Revenue Attribution
 * (mission §4).
 *
 * DIRECT vs. INFLUENCED, defined by one consistent, principled rule
 * rather than a per-dimension judgment call:
 *
 *   DIRECT — the attribution key was recorded on the Payment row itself
 *   at checkout-creation time (Payment.campaignId, Payment.opportunityId).
 *   No inference: whoever created the checkout set this explicitly.
 *
 *   INFLUENCED — the attribution key is derived by joining through
 *   another entity AFTER the fact (Payment.leadId → Lead.source/utm/
 *   program; Payment.leadId → the most recent WhatsApp campaign Message
 *   sent to that lead before the payment; Payment.leadId → a
 *   WorkflowRun that ran against that lead). Correlation the data
 *   supports, not a recorded fact about why the customer paid.
 *
 * Never fabricated: a Payment with no leadId contributes to NO
 * influenced dimension (there is nothing to join through) — it still
 * counts toward DIRECT dimensions if campaignId/opportunityId are set.
 */

export type AttributionType = "direct" | "influenced";

export interface AttributionRow {
  /** Stable id for the attributed entity — a Campaign id, a UTM source
   *  string, a counsellor's User id, etc. */
  key: string;
  /** Human-readable — the Campaign's name, the raw UTM string, the
   *  counsellor's name. */
  label: string;
  revenueInr: number;
  paymentCount: number;
}

export interface AttributionDimension {
  dimension:
    | "leadSource"
    | "utmSource"
    | "utmMedium"
    | "utmCampaign"
    | "marketingCampaign"
    | "whatsappCampaign"
    | "automationWorkflow"
    | "counsellor"
    | "program"
    | "pipeline";
  type: AttributionType;
  rows: AttributionRow[];
  /** Succeeded-payment revenue (INR) in range that could NOT be
   *  attributed on this dimension (e.g. no leadId to join through, or a
   *  campaignId that doesn't resolve) — surfaced explicitly rather than
   *  silently dropped from the total, so rows.reduce(...) +
   *  unattributedInr always equals the range's total collected revenue
   *  (INR only — see RevenueMetrics.collectedByOtherCurrency). */
  unattributedInr: number;
}

export interface RevenueAttributionResult {
  range: DateRange;
  /** Total INR succeeded-payment revenue this result's dimensions are
   *  attributing — matches RevenueMetrics.collectedRevenueInr for the
   *  same range exactly (same source query), included here so a caller
   *  can sanity-check rows + unattributed = totalCollectedRevenueInr
   *  without a second fetch. */
  totalCollectedRevenueInr: number;
  dimensions: AttributionDimension[];
}

import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Campaign ROI (mission
 * §7), for the marketing Campaign entity (lib/services/campaigns —
 * distinct from WhatsAppCampaign, covered separately in
 * whatsappRevenueTypes.ts).
 */
export interface CampaignRoiEntry {
  campaignId: string;
  campaignName: string;
  /** Real ad spend from a connected AdsProvider (Meta Ads today), the
   *  exact same figure lib/services/marketing/campaignMetrics.ts
   *  already computes — reused, not recomputed. */
  spendInr: number;
  /** true when spendInr came from a real, connected AdsProvider;
   *  false when it fell back to Campaign.budgetInr (the mission's own
   *  "if campaign spend is not currently stored, create an appropriate
   *  optional extension" — that field already existed before this
   *  module). A planned budget is a real number but a different KIND
   *  of number than confirmed ad-platform spend; this flag lets a
   *  caller show that distinction rather than presenting both
   *  identically. */
  spendSource: "ads_provider" | "budget_field" | "unavailable";
  /** Leads whose Lead.utm.utmCampaign matches this Campaign's own
   *  utmCampaign string, created in range — a string match, not an id
   *  join (Lead carries no direct campaignId), disclosed via
   *  leadMatchAvailable below. */
  leads: number;
  /** false when this Campaign has no utmCampaign configured, meaning
   *  `leads` is definitionally 0, not "zero leads measured." */
  leadMatchAvailable: boolean;
  /** Registrations created in range with this campaignId — a real id
   *  join (Registration.campaignId). */
  registrationsInRange: number;
  /** Campaign.registrationCount — the pre-existing, ALL-TIME
   *  denormalized counter (not scoped to `range`), surfaced alongside
   *  the range-scoped figure above for context, not in place of it. */
  lifetimeRegistrations: number;
  /** Confirmed registrations in range with this campaignId — the
   *  stronger "conversion" signal (paid/enrolled), distinct from the
   *  broader ConversionFunnel definition
   *  (lib/services/marketing/funnels.ts) that counts any registration
   *  status as a conversion. */
  conversions: number;
  /** Succeeded-Payment revenue (INR) in range with this Payment's own
   *  campaignId set directly — DIRECT attribution, the same rule
   *  attributionTypes.ts's own marketingCampaign dimension uses. */
  revenueInr: number;
  cpl: number | null;
  cpa: number | null;
  roas: number | null;
  /** (revenue − spend) / spend × 100. Null when spendInr is 0 (nothing
   *  to divide by), not a fabricated infinite return. */
  roiPct: number | null;
}

export interface CampaignRoiResult {
  range: DateRange;
  campaigns: CampaignRoiEntry[];
}

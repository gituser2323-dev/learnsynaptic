import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — WhatsApp Performance +
 * Revenue (mission §8). sentCount/deliveredCount/readCount/failedCount/
 * replyCount/clickCount are WhatsAppCampaign's own pre-existing,
 * denormalized rollups (Module 2.5) — reused verbatim, never
 * recomputed. Only revenueInr/conversions/the four rate fields are new.
 */
export interface WhatsAppCampaignRevenueEntry {
  campaignId: string;
  campaignName: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  replyCount: number;
  clickCount: number;
  /** deliveredCount / sentCount, 0–100. Null if sentCount is 0. */
  deliveryRatePct: number | null;
  /** readCount / deliveredCount, 0–100. Null if deliveredCount is 0. */
  readRatePct: number | null;
  /** replyCount / deliveredCount, 0–100. Null if deliveredCount is 0. */
  replyRatePct: number | null;
  /** This app's WhatsApp campaigns message EXISTING Leads/contacts
   *  (audienceSource resolves against already-captured Leads) — they do
   *  not create new Lead records the way a web form does, so "leads
   *  generated" has no real value to report for this channel. Always
   *  null, not a fabricated 0 — see the module doc above. */
  leadsGenerated: null;
  /** Succeeded-Payment revenue (INR) in range, attributed to this
   *  campaign via the same "last WhatsApp touch before payment" rule
   *  attributionTypes.ts's own whatsappCampaign dimension uses —
   *  reused from that same computation, not a second join. INFLUENCED,
   *  not direct (see that file's own DIRECT/INFLUENCED rule). */
  revenueInr: number;
  /** Count of succeeded payments attributed to this campaign by the
   *  same last-touch rule — the strongest real "conversion" signal this
   *  data supports for a WhatsApp send (no landing-page/registration
   *  click-through tracking exists for this channel). */
  conversions: number;
  /** conversions / deliveredCount, 0–100. Null if deliveredCount is 0. */
  conversionRatePct: number | null;
}

export interface WhatsAppRevenueResult {
  range: DateRange;
  campaigns: WhatsAppCampaignRevenueEntry[];
}

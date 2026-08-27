import type { WhatsAppMarketingConsent } from "@/lib/services/leads/types";

/**
 * Phase 2B — WhatsApp marketing consent helpers.
 * Marketing campaign sends require explicit opted_in. unknown ≠ opted in.
 */

const STOP_KEYWORD_RE = /^(stop|unsubscribe|cancel|remove\s+me)\b/i;

export function normalizeWhatsAppMarketingConsent(
  value: WhatsAppMarketingConsent | undefined | null,
): WhatsAppMarketingConsent {
  if (value === "opted_in" || value === "opted_out" || value === "unknown") return value;
  return "unknown";
}

/** True only when the lead has explicitly opted in to marketing WhatsApp. */
export function isWhatsAppMarketingSendAllowed(
  consent: WhatsAppMarketingConsent | undefined | null,
): boolean {
  return normalizeWhatsAppMarketingConsent(consent) === "opted_in";
}

/**
 * Detects common STOP / unsubscribe keywords on inbound WhatsApp text.
 * Whole-message start match (trimmed) — avoids false positives mid-sentence.
 */
export function isWhatsAppStopKeyword(body: string | undefined | null): boolean {
  if (!body) return false;
  return STOP_KEYWORD_RE.test(body.trim());
}

export const WHATSAPP_MARKETING_SUPPRESSION_REASON =
  "WhatsApp marketing not opted in (consent unknown or opted out)";

export const WHATSAPP_TEMPLATE_NOT_APPROVED_REASON =
  "Template is not Meta-approved; sync templates and wait for approvalStatus=approved";

import type { PaginatedResult } from "@/lib/pagination";

/**
 * WhatsApp Platform (Phase 2), Module 2.4 — Webhook & API Monitoring.
 *
 * `source` is a plain string, not a fixed union, on purpose: the
 * blueprint's own spec for this module calls out that `webhookDeliveries`
 * is "shared with 6.5's generic webhook system — one collection, two
 * producers." 6.4/6.5 don't exist yet, so today only `"whatsapp"` is
 * ever written, but the schema shouldn't need a migration when a second
 * producer (a generic webhook receiver, Module 6.5) shows up later.
 *
 * `outcome` is the one thing this module's own Definition of Done
 * requires be distinguishable: "a signature-verification failure is
 * visible in this log, distinct from a successful-but-unrecognized
 * event." Three outcomes cover every real case a webhook POST can end
 * in:
 * - "processed" — signature verified, and the payload carried at least
 *   one status event or inbound message this app acted on.
 * - "unrecognized" — signature verified, but the payload carried
 *   nothing actionable (an empty/unsupported delivery) — a real,
 *   different situation from a forged or misconfigured request.
 * - "signature_invalid" — the HMAC check itself failed; the payload
 *   was never trusted enough to even look inside.
 */
export type WebhookDeliveryOutcome = "processed" | "unrecognized" | "signature_invalid";

export interface WebhookDelivery {
  id: string;
  source: string;
  outcome: WebhookDeliveryOutcome;
  /** Count of status events + inbound messages this delivery carried
   *  (0 for "unrecognized"/"signature_invalid"). */
  eventCount: number;
  /** Short human-readable summary for the admin panel, e.g. "2 status
   *  events, 1 inbound message" or "invalid X-Hub-Signature-256". */
  detail: string;
  receivedAt: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
}

export interface CreateWebhookDeliveryInput {
  source: string;
  outcome: WebhookDeliveryOutcome;
  eventCount: number;
  detail: string;
  organizationId?: string;
}

export interface WebhookDeliveryListFilters {
  source?: string;
  outcome?: WebhookDeliveryOutcome;
}

export interface WebhookDeliveryRepository {
  create(input: CreateWebhookDeliveryInput): Promise<WebhookDelivery>;
  list(filters: WebhookDeliveryListFilters, page: number, limit: number): Promise<PaginatedResult<WebhookDelivery>>;
}

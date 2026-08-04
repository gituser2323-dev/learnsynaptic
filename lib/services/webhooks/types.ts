import type { PaginatedResult } from "@/lib/pagination";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * domain layer for OUTBOUND webhook delivery. Deliberately a new,
 * separate concept from Module 2.4's `webhookDeliveries` collection:
 * that collection logs webhooks LearnSynaptic *receives* (from
 * Meta/Postmark) with an inbound-only `outcome` enum
 * ("processed"/"unrecognized"/"signature_invalid") and no target URL,
 * HTTP status, or attempt/retry fields — structurally unable to honestly
 * represent an outbound delivery attempt without those. 6.5's own
 * `WebhookDeliveryAttempt` below is that outbound counterpart; Module
 * 2.4's own inbound monitoring is untouched.
 *
 * Also a different shape from the Integrations Registry's own
 * IntegrationConnection (Module 6.1, reused as-is for Slack/Teams/
 * Discord below): a "connection" is one row per provider id, but an
 * admin can register many independent webhook endpoints (a Zapier
 * hook, an internal ops tool, a partner's system), each with its own
 * URL/secret/event subscription — genuinely a one-to-many concept,
 * not a fit for IntegrationConnection's one-row-per-providerId shape.
 */

export type WebhookEndpointStatus = "active" | "disabled" | "auto_disabled";

/** `["*"]` means "every event type" — the same wildcard convention
 *  the event bus itself now supports (see lib/events/eventBus.ts). */
export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  /** AES-256-GCM ciphertext (secretCrypto.ts) — never the raw secret,
   *  the same "no raw secret in a normal DB field" invariant Module
   *  6.3's OAuth tokens already established. */
  encryptedSecret: string;
  subscribedEventTypes: string[];
  status: WebhookEndpointStatus;
  consecutiveFailures: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastFailureReason?: string;
  createdBy?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookEndpointInput {
  name: string;
  url: string;
  subscribedEventTypes: string[];
  encryptedSecret: string;
  createdBy?: string;
  organizationId?: string;
}

export interface UpdateWebhookEndpointInput {
  name?: string;
  url?: string;
  subscribedEventTypes?: string[];
  status?: WebhookEndpointStatus;
  encryptedSecret?: string;
  consecutiveFailures?: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastFailureReason?: string;
}

export interface WebhookEndpointListFilters {
  status?: WebhookEndpointStatus;
}

export interface WebhookEndpointRepository {
  findById(id: string): Promise<WebhookEndpoint | null>;
  create(input: CreateWebhookEndpointInput): Promise<WebhookEndpoint>;
  update(id: string, input: UpdateWebhookEndpointInput): Promise<WebhookEndpoint>;
  list(filters: WebhookEndpointListFilters, page: number, limit: number): Promise<PaginatedResult<WebhookEndpoint>>;
  /** The dispatcher's own query — every active endpoint, unpaginated
   *  (an admin registering hundreds of endpoints is not a real
   *  near-term scale concern, the same judgment the catalog's own
   *  static-array approach already makes elsewhere in this app). */
  listActive(): Promise<WebhookEndpoint[]>;
}

export type WebhookDeliveryOutcome = "pending" | "delivered" | "failed" | "dead_letter";

/**
 * One row per delivery ATTEMPT (not one per event) — the same
 * "Delivery History" granularity the mission names explicitly, so a
 * retried delivery's own attempt-by-attempt story (attempt 1 failed
 * with a 503, attempt 2 succeeded) is visible, not collapsed into one
 * row that silently changes.
 */
export interface WebhookDeliveryAttempt {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  /** The event's own payload, exactly as published — never the
   *  endpoint's secret or this app's own internal credentials, which
   *  never appear in an event payload in the first place. */
  payloadSnapshot: Record<string, unknown>;
  attempt: number;
  httpStatusCode?: number;
  /** Truncated (see validation.ts) — never logs more than a small,
   *  safe prefix of a third party's response body. */
  responseSnippet?: string;
  outcome: WebhookDeliveryOutcome;
  error?: string;
  /** Links back to the scheduler job driving this attempt's retry
   *  timing — lib/services/scheduler/ owns backoff, this collection
   *  only records outcomes. */
  scheduledJobId?: string;
  organizationId?: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface CreateWebhookDeliveryAttemptInput {
  endpointId: string;
  eventId: string;
  eventType: string;
  payloadSnapshot: Record<string, unknown>;
  attempt: number;
  outcome: WebhookDeliveryOutcome;
  httpStatusCode?: number;
  responseSnippet?: string;
  error?: string;
  deliveredAt?: string;
  scheduledJobId?: string;
  organizationId?: string;
}

export interface UpdateWebhookDeliveryAttemptInput {
  httpStatusCode?: number;
  responseSnippet?: string;
  outcome?: WebhookDeliveryOutcome;
  error?: string;
  deliveredAt?: string;
}

export interface WebhookDeliveryListFilters {
  endpointId?: string;
  outcome?: WebhookDeliveryOutcome;
  eventType?: string;
}

export interface WebhookDeliveryAttemptRepository {
  findById(id: string): Promise<WebhookDeliveryAttempt | null>;
  create(input: CreateWebhookDeliveryAttemptInput): Promise<WebhookDeliveryAttempt>;
  update(id: string, input: UpdateWebhookDeliveryAttemptInput): Promise<WebhookDeliveryAttempt>;
  list(filters: WebhookDeliveryListFilters, page: number, limit: number): Promise<PaginatedResult<WebhookDeliveryAttempt>>;
}

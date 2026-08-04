import { getWebhookEndpointRepository, getWebhookDeliveryAttemptRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { encryptSecret, decryptSecret, generateWebhookSecret } from "./secretCrypto";
import { deliverWebhookPayload } from "./delivery";
import { validateRegisterEndpointInput, type WebhookValidationError } from "./validation";
import { WebhookEndpointNotFoundError } from "./errors";
import type { PaginatedResult } from "@/lib/pagination";
import type {
  WebhookDeliveryAttempt,
  WebhookDeliveryListFilters,
  WebhookEndpoint,
  WebhookEndpointListFilters,
} from "./types";

export type RegisterEndpointResult =
  | { success: true; endpoint: WebhookEndpoint; secret: string }
  | { success: false; errors: WebhookValidationError[] };

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 * ONE service every admin route calls for outbound webhook endpoint
 * lifecycle + delivery visibility. Mirrors calendarService.ts/
 * fileStorageService.ts's own shape: validate → persist → audit, with
 * real vendor/HTTP calls delegated to delivery.ts.
 */
export const webhookService = {
  /** Returns the endpoint's real secret ONCE, in plaintext, at
   *  registration time — the same "shown once, never retrievable
   *  again" UX every real webhook-secret product uses (GitHub, Stripe,
   *  etc.), since after this call only the encrypted form is ever
   *  persisted. */
  async registerEndpoint(input: unknown, context: AuditContext = {}): Promise<RegisterEndpointResult> {
    const validation = validateRegisterEndpointInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };
    const data = validation.data;

    const secret = data.secret ?? generateWebhookSecret();
    const repository = await getWebhookEndpointRepository();
    const endpoint = await repository.create({
      name: data.name,
      url: data.url,
      subscribedEventTypes: data.subscribedEventTypes,
      encryptedSecret: encryptSecret(secret),
      createdBy: context.actorId,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.WEBHOOK_ENDPOINT_CREATED,
      entityType: "WebhookEndpoint",
      entityId: endpoint.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { name: endpoint.name, subscribedEventTypes: endpoint.subscribedEventTypes },
    });

    return { success: true, endpoint, secret };
  },

  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    const repository = await getWebhookEndpointRepository();
    return repository.findById(id);
  },

  async listEndpoints(filters: WebhookEndpointListFilters, page = 1, limit = 20): Promise<PaginatedResult<WebhookEndpoint>> {
    const repository = await getWebhookEndpointRepository();
    return repository.list(filters, page, limit);
  },

  async updateEndpoint(
    id: string,
    input: { name?: string; url?: string; subscribedEventTypes?: string[] },
    context: AuditContext = {},
  ): Promise<WebhookEndpoint> {
    const repository = await getWebhookEndpointRepository();
    const existing = await repository.findById(id);
    if (!existing) throw new WebhookEndpointNotFoundError(id);

    const updated = await repository.update(id, input);
    await auditLogService.record({
      action: AUDIT_ACTIONS.WEBHOOK_ENDPOINT_UPDATED,
      entityType: "WebhookEndpoint",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { fields: Object.keys(input) },
    });
    return updated;
  },

  /** Enable/Disable — the manual half of "Disable Broken Endpoints";
   *  the automatic half lives in jobHandlers.ts's own consecutive-
   *  failure threshold. Re-enabling always clears consecutiveFailures
   *  — a fresh start, not a countdown resuming mid-way. */
  async setEndpointStatus(id: string, status: "active" | "disabled", context: AuditContext = {}): Promise<WebhookEndpoint> {
    const repository = await getWebhookEndpointRepository();
    const existing = await repository.findById(id);
    if (!existing) throw new WebhookEndpointNotFoundError(id);

    const updated = await repository.update(id, { status, ...(status === "active" ? { consecutiveFailures: 0 } : {}) });
    await auditLogService.record({
      action: AUDIT_ACTIONS.WEBHOOK_ENDPOINT_UPDATED,
      entityType: "WebhookEndpoint",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { status },
    });
    return updated;
  },

  async deleteEndpoint(id: string, context: AuditContext = {}): Promise<void> {
    const repository = await getWebhookEndpointRepository();
    const existing = await repository.findById(id);
    if (!existing) throw new WebhookEndpointNotFoundError(id);

    // No hard-delete method exists on the repository by design — the
    // same "never truly gone, always inspectable" posture Files/
    // Meetings' own soft-delete already established. "Deleted" from an
    // admin's perspective is a real terminal status.
    await repository.update(id, { status: "disabled" });
    await auditLogService.record({
      action: AUDIT_ACTIONS.WEBHOOK_ENDPOINT_DELETED,
      entityType: "WebhookEndpoint",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { name: existing.name },
    });
  },

  /** Returns the new secret ONCE, same posture as registerEndpoint.
   *  Unlike an inbound-signature rotation (which needs a grace period
   *  accepting both old and new secrets, since a real vendor can't be
   *  told to switch instantly), this app is the SENDER — the very next
   *  delivery simply signs with the new secret, no dual-secret window
   *  needed. */
  async rotateSecret(id: string, context: AuditContext = {}): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
    const repository = await getWebhookEndpointRepository();
    const existing = await repository.findById(id);
    if (!existing) throw new WebhookEndpointNotFoundError(id);

    const secret = generateWebhookSecret();
    const endpoint = await repository.update(id, { encryptedSecret: encryptSecret(secret) });

    await auditLogService.record({
      action: AUDIT_ACTIONS.WEBHOOK_ENDPOINT_SECRET_ROTATED,
      entityType: "WebhookEndpoint",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
    });
    return { endpoint, secret };
  },

  /** "Test Endpoint" — an immediate, synchronous real delivery (never
   *  queued through the scheduler), reusing the exact same signing/
   *  HTTP logic a real event delivery uses, so a green "Test Endpoint"
   *  result means the endpoint is genuinely reachable and correctly
   *  verifying signatures, not just structurally configured. Recorded
   *  in Delivery History like any other attempt, eventType
   *  "webhook.test", so it's not invisible after the fact. */
  async testEndpoint(id: string): Promise<{ success: boolean; httpStatusCode?: number; responseSnippet?: string; error?: string }> {
    const repository = await getWebhookEndpointRepository();
    const attemptRepository = await getWebhookDeliveryAttemptRepository();
    const endpoint = await repository.findById(id);
    if (!endpoint) throw new WebhookEndpointNotFoundError(id);

    const testEventId = `test_${Date.now()}`;
    const testPayload = { message: "This is a test event from LearnSynaptic.", triggeredAt: new Date().toISOString() };
    const result = await deliverWebhookPayload(endpoint, testEventId, "webhook.test", testPayload);

    await attemptRepository.create({
      endpointId: id,
      eventId: testEventId,
      eventType: "webhook.test",
      payloadSnapshot: testPayload,
      attempt: 1,
      outcome: result.success ? "delivered" : "dead_letter",
      httpStatusCode: result.httpStatusCode,
      responseSnippet: result.responseSnippet,
      error: result.error,
      organizationId: endpoint.organizationId,
    });

    return { success: result.success, httpStatusCode: result.httpStatusCode, responseSnippet: result.responseSnippet, error: result.error };
  },

  async listDeliveries(filters: WebhookDeliveryListFilters, page = 1, limit = 20): Promise<PaginatedResult<WebhookDeliveryAttempt>> {
    const repository = await getWebhookDeliveryAttemptRepository();
    return repository.list(filters, page, limit);
  },

  /** "Replay Failed Events" — re-delivers a specific PAST delivery
   *  attempt's own exact payload snapshot to its own endpoint, as a
   *  fresh attempt-1 row. Deliberately NOT "re-publish the original
   *  domain event through the whole event bus" — the mission's own
   *  "where appropriate" hedge on Event Replay: re-publishing
   *  lead.created, for instance, would re-trigger automation/scoring/
   *  assignment a second time, which is never what "retry a failed
   *  webhook" means. This replays the DELIVERY, not the event. */
  async replayDelivery(attemptId: string, context: AuditContext = {}): Promise<WebhookDeliveryAttempt> {
    const attemptRepository = await getWebhookDeliveryAttemptRepository();
    const endpointRepository = await getWebhookEndpointRepository();

    const original = await attemptRepository.findById(attemptId);
    if (!original) throw new Error(`Delivery attempt ${attemptId} not found.`);
    const endpoint = await endpointRepository.findById(original.endpointId);
    if (!endpoint) throw new WebhookEndpointNotFoundError(original.endpointId);

    const result = await deliverWebhookPayload(endpoint, original.eventId, original.eventType, original.payloadSnapshot);
    const replayed = await attemptRepository.create({
      endpointId: endpoint.id,
      eventId: original.eventId,
      eventType: original.eventType,
      payloadSnapshot: original.payloadSnapshot,
      attempt: original.attempt + 1,
      outcome: result.success ? "delivered" : "dead_letter",
      httpStatusCode: result.httpStatusCode,
      responseSnippet: result.responseSnippet,
      error: result.error,
      organizationId: endpoint.organizationId,
    });

    if (result.success) {
      await endpointRepository.update(endpoint.id, { consecutiveFailures: 0, lastSuccessAt: new Date().toISOString() });
    }

    await auditLogService.record({
      action: AUDIT_ACTIONS.WEBHOOK_DELIVERY_REPLAYED,
      entityType: "WebhookEndpoint",
      entityId: endpoint.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { originalAttemptId: attemptId, eventType: original.eventType, success: result.success },
    });

    return replayed;
  },

  /** Exposed so an admin route can decrypt+show a secret's own last
   *  few characters for confirmation without ever showing the full
   *  value again post-registration — never exported for full-value
   *  retrieval. */
  _decryptSecretSuffix(encryptedSecret: string): string {
    const secret = decryptSecret(encryptedSecret);
    return secret.slice(-4);
  },
};

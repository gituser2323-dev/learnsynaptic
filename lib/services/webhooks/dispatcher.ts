import { subscribe } from "@/lib/events";
import type { DomainEvent } from "@/lib/events";
import { getWebhookEndpointRepository, getWebhookDeliveryAttemptRepository } from "@/lib/db";
import { enqueueJob } from "@/lib/services/scheduler";
import { integrationService } from "@/lib/services/integrations";
import { isNotificationProviderId } from "./notifications";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "webhooks.dispatcher" });

/** A real, disclosed default: 5 attempts spread over roughly 5 hours
 *  (1m, 5m, 15m, 60m, 240m) — generous enough to ride out a receiving
 *  endpoint's own short outage, bounded enough that a permanently dead
 *  endpoint reaches "dead_letter" the same business day, not never. */
const WEBHOOK_RETRY_POLICY = { maxAttempts: 5, backoffMinutes: [1, 5, 15, 60, 240] };
/** Notifications are lower-stakes than a third-party data-sync webhook
 *  — a shorter, smaller retry window. */
const NOTIFICATION_RETRY_POLICY = { maxAttempts: 3, backoffMinutes: [2, 10, 30] };

function matchesSubscription(subscribedEventTypes: string[], eventType: string): boolean {
  return subscribedEventTypes.includes("*") || subscribedEventTypes.includes(eventType);
}

async function dispatchToWebhookEndpoints(event: DomainEvent): Promise<void> {
  const endpointRepository = await getWebhookEndpointRepository();
  const attemptRepository = await getWebhookDeliveryAttemptRepository();
  const endpoints = await endpointRepository.listActive();

  const matching = endpoints.filter((e) => matchesSubscription(e.subscribedEventTypes, event.type));
  for (const endpoint of matching) {
    const payload = (event.payload && typeof event.payload === "object" ? event.payload : {}) as Record<string, unknown>;
    // A "pending" row exists the instant the event is matched, before
    // the scheduler's own poller has even run once — real "Delivery
    // Status" visibility for an admin watching Delivery History, not
    // just after the fact.
    const attemptRow = await attemptRepository.create({
      endpointId: endpoint.id,
      eventId: event.id,
      eventType: event.type,
      payloadSnapshot: payload,
      attempt: 1,
      outcome: "pending",
      organizationId: endpoint.organizationId,
    });

    const job = await enqueueJob({
      jobType: "webhook.deliver",
      payload: { attemptRowId: attemptRow.id, endpointId: endpoint.id, eventId: event.id, eventType: event.type, payload },
      runAt: new Date().toISOString(),
      retryPolicy: WEBHOOK_RETRY_POLICY,
    });
    logger.info("webhook.delivery_enqueued", { endpointId: endpoint.id, eventId: event.id, eventType: event.type, jobId: job.id });
  }
}

async function dispatchToNotificationProviders(event: DomainEvent): Promise<void> {
  const integrations = await integrationService.listIntegrations();
  const payload = (event.payload && typeof event.payload === "object" ? event.payload : {}) as Record<string, unknown>;

  for (const integration of integrations) {
    const providerId = integration.provider.id;
    if (!isNotificationProviderId(providerId)) continue;
    if (integration.status !== "connected" || !integration.enabled) continue;
    if (integration.credentialRef.type !== "webhook_url") continue;

    // Event Subscriptions: config.subscribedEventTypes, defaulting to
    // "every event" when unset — the same wildcard convention webhook
    // endpoints use, so a freshly connected Slack workspace starts
    // useful immediately rather than silently receiving nothing until
    // an admin configures a subscription list.
    const configuredTypes = Array.isArray(integration.config.subscribedEventTypes)
      ? (integration.config.subscribedEventTypes as unknown[]).filter((v): v is string => typeof v === "string")
      : ["*"];
    if (!matchesSubscription(configuredTypes.length > 0 ? configuredTypes : ["*"], event.type)) continue;

    const job = await enqueueJob({
      jobType: "notification.deliver",
      payload: { providerId, eventId: event.id, eventType: event.type, payload, occurredAt: event.occurredAt },
      runAt: new Date().toISOString(),
      retryPolicy: NOTIFICATION_RETRY_POLICY,
    });
    logger.info("notification.delivery_enqueued", { providerId, eventId: event.id, eventType: event.type, jobId: job.id });
  }
}

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 * one wildcard subscriber (see eventBus.ts's own `WILDCARD_EVENT_TYPE`
 * support, added specifically for this) fanning every published event
 * out to whichever registered webhook endpoints and connected
 * notification providers subscribed to it. Called once, from
 * eventBus.ts's own bootstrappers array — never call this directly.
 */
export function registerWebhookEventSubscriber(): void {
  subscribe("*", async (event: DomainEvent) => {
    await Promise.all([dispatchToWebhookEndpoints(event), dispatchToNotificationProviders(event)]);
  });
}

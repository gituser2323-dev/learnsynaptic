import { getWebhookEndpointRepository, getWebhookDeliveryAttemptRepository } from "@/lib/db";
import { registerJobHandler } from "@/lib/services/scheduler";
import type { JobHandler, JobOutcome, ScheduledJob } from "@/lib/services/scheduler";
import { integrationService } from "@/lib/services/integrations";
import { deliverWebhookPayload } from "./delivery";
import { decryptSecret } from "./secretCrypto";
import { isNotificationProviderId, getNotificationProvider, formatEventAsNotification } from "./notifications";
import type { DomainEvent } from "@/lib/events";

const WEBHOOK_AUTO_DISABLE_THRESHOLD = 10;

interface WebhookDeliverJobPayload {
  attemptRowId: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 * "webhook.deliver" job type, reusing lib/services/scheduler/'s
 * existing poller/backoff/dead-letter machinery exactly (no second
 * retry mechanism built): the dispatcher (dispatcher.ts) enqueues one
 * of these per matching endpoint via `enqueueJob()`, and this handler
 * is what `runDueScheduledJobs()` invokes on each attempt.
 *
 * One WebhookDeliveryAttempt ROW per real HTTP attempt (the "Delivery
 * History" requirement's own attempt-by-attempt granularity — see
 * types.ts's own doc comment): the FIRST attempt updates the row the
 * dispatcher already created as "pending"; every retry creates a new
 * row, so a delivery that failed twice before succeeding shows all
 * three real attempts, not one row silently overwritten three times.
 */
const webhookDeliverHandler: JobHandler = async (job: ScheduledJob): Promise<JobOutcome> => {
  const payload = job.payload as unknown as WebhookDeliverJobPayload;
  const endpointRepository = await getWebhookEndpointRepository();
  const attemptRepository = await getWebhookDeliveryAttemptRepository();

  const endpoint = await endpointRepository.findById(payload.endpointId);
  // The endpoint was deleted or disabled after this job was queued —
  // honor that rather than delivering to a URL an admin turned off.
  if (!endpoint || endpoint.status !== "active") {
    return { result: "completed" };
  }

  const attemptNumber = job.attempts + 1;
  const result = await deliverWebhookPayload(endpoint, payload.eventId, payload.eventType, payload.payload);

  const maxAttempts = job.retryPolicy?.maxAttempts ?? 1;
  const isFinalAttempt = attemptNumber >= maxAttempts || !result.retryable;
  const rowOutcome = result.success ? "delivered" : isFinalAttempt ? "dead_letter" : "failed";

  const rowUpdate = {
    httpStatusCode: result.httpStatusCode,
    responseSnippet: result.responseSnippet,
    outcome: rowOutcome as "delivered" | "failed" | "dead_letter",
    error: result.error,
    deliveredAt: result.success ? new Date().toISOString() : undefined,
  };

  if (job.attempts === 0) {
    await attemptRepository.update(payload.attemptRowId, rowUpdate);
  } else {
    await attemptRepository.create({
      endpointId: payload.endpointId,
      eventId: payload.eventId,
      eventType: payload.eventType,
      payloadSnapshot: payload.payload,
      attempt: attemptNumber,
      organizationId: endpoint.organizationId,
      ...rowUpdate,
    });
  }

  if (result.success) {
    await endpointRepository.update(endpoint.id, {
      consecutiveFailures: 0,
      lastSuccessAt: new Date().toISOString(),
    });
    return { result: "completed" };
  }

  const consecutiveFailures = endpoint.consecutiveFailures + 1;
  // "Disable Broken Endpoints" — a real, disclosed auto-behavior, not
  // just a manual admin action: an endpoint that has failed this many
  // consecutive TIMES DELIVERED (across separate events, not retries
  // of the same event) stops receiving new deliveries until an admin
  // re-enables it, the same "a real kill-switch, not just a UI toggle
  // that does nothing on its own" posture 6.1/6.2/6.3's own
  // Integrations Registry gate already established.
  const shouldAutoDisable = isFinalAttempt && consecutiveFailures >= WEBHOOK_AUTO_DISABLE_THRESHOLD;
  await endpointRepository.update(endpoint.id, {
    consecutiveFailures: isFinalAttempt ? consecutiveFailures : endpoint.consecutiveFailures,
    lastFailureAt: new Date().toISOString(),
    lastFailureReason: result.error,
    // Omitted entirely (not set to `undefined`) when not auto-disabling —
    // an explicit `status: undefined` key depends on the update path
    // dropping undefined values before persisting, which the in-memory
    // repository's own Object.assign-based update does NOT do: it would
    // silently wipe an "active" endpoint's status on every non-final
    // failure. Conditionally spreading the key is correct regardless of
    // which repository is behind the call.
    ...(shouldAutoDisable ? { status: "auto_disabled" as const } : {}),
  });

  return { result: "failed", retryable: result.retryable, error: result.error ?? "Delivery failed." };
};

interface NotificationDeliverJobPayload {
  providerId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

/**
 * The "notification.deliver" job type — same shared scheduler, a much
 * smaller retry policy (a chat notification arriving a few minutes
 * late is a low-stakes delay, unlike a webhook a third-party system
 * might depend on for real data sync). Delivery outcomes are recorded
 * through Module 6.1's own `integrationService.recordSync()` — reusing
 * the existing Integrations Registry health/log surface rather than a
 * second, parallel notification-delivery-log collection.
 */
const notificationDeliverHandler: JobHandler = async (job: ScheduledJob): Promise<JobOutcome> => {
  const payload = job.payload as unknown as NotificationDeliverJobPayload;
  if (!isNotificationProviderId(payload.providerId)) {
    return { result: "failed", retryable: false, error: `Unknown notification provider: ${payload.providerId}` };
  }

  const integration = await integrationService.getIntegration(payload.providerId);
  if (!integration || integration.status !== "connected" || !integration.enabled || integration.credentialRef.type !== "webhook_url") {
    // Disconnected/disabled after this was queued — honor that, no-op.
    return { result: "completed" };
  }

  const webhookUrl = decryptSecret(integration.credentialRef.encryptedUrl);
  const provider = getNotificationProvider(payload.providerId);
  const event: DomainEvent = {
    id: payload.eventId,
    type: payload.eventType,
    version: "1",
    payload: payload.payload,
    occurredAt: payload.occurredAt,
  };
  const message = formatEventAsNotification(event);

  try {
    await provider.send(webhookUrl, message);
    await integrationService.recordSync(payload.providerId, "success", `Delivered "${payload.eventType}" notification.`);
    return { result: "completed" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Notification delivery failed.";
    await integrationService.recordSync(payload.providerId, "failure", errorMessage);
    return { result: "failed", retryable: true, error: errorMessage };
  }
};

export function registerWebhookJobHandlers(): void {
  registerJobHandler("webhook.deliver", webhookDeliverHandler);
  registerJobHandler("notification.deliver", notificationDeliverHandler);
}

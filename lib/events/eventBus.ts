import { randomUUID } from "crypto";
import { createLogger } from "@/lib/logger";
import type { DomainEvent, EventHandler, PublishOptions } from "./types";

const logger = createLogger({ service: "events" });

/** A handler registered under this key (Module 6.5) receives every
 *  published event, regardless of type — the seam a generic event-
 *  distribution layer needs (a webhook endpoint or a Slack connection
 *  can subscribe to an admin-configured *list* of event types, not a
 *  fixed one this bus's own API would need to know about ahead of
 *  time), without changing subscribe()'s existing per-type contract
 *  for every other caller. */
const WILDCARD_EVENT_TYPE = "*";

/**
 * In-process publish/subscribe. Deliberately NOT a message broker — no
 * infrastructure for one exists in this app — but a genuine seam: a
 * future real broker (SQS, a Redis stream, etc.) could sit behind this
 * exact publish()/subscribe() API. subscribe() registrations would move
 * to the broker's consumer setup and publish() would push to the broker
 * instead of calling handlers in-process, but WHAT gets published and
 * WHAT handlers do wouldn't need to change.
 *
 * A handler's failure never propagates to the publisher and never
 * prevents other handlers for the same event from running — same
 * "never block the business operation" principle as
 * lib/services/auditLog's record().
 */
type HandlerMap = Map<string, EventHandler[]>;
const handlers: HandlerMap = new Map();

export function subscribe<TPayload = unknown>(eventType: string, handler: EventHandler<TPayload>): void {
  const existing = handlers.get(eventType) ?? [];
  existing.push(handler as EventHandler);
  handlers.set(eventType, existing);
}

/**
 * Self-bootstrapping consumer registration — NOT an incidental design
 * choice. A prior version relied on instrumentation.ts calling
 * subscribe() once at server startup; live testing against a real
 * running server proved that unreliable: Next.js bundles
 * instrumentation.ts and each API route handler into separate module
 * graphs, so a shared module-level `handlers` Map is not guaranteed to
 * be the same object across them, even within one running process. A
 * subscriber registered from instrumentation.ts's copy of this module is
 * invisible to publish() calls from a route handler's copy.
 *
 * The fix: publish() ensures its OWN module instance's subscribers are
 * registered before every call, via a dynamic import (avoiding a
 * compile-time circular dependency between this generic infra and a
 * specific consumer). This guarantees correctness regardless of how
 * Next.js chooses to bundle things — publish() and its subscribers are
 * always in the same module instance by construction, since the
 * registration happens from inside this file.
 */
const bootstrappers: (() => Promise<void>)[] = [
  async () => {
    const { registerAutomationTriggers } = await import("@/lib/services/automation");
    registerAutomationTriggers();
  },
  // Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
  // one wildcard subscriber fanning every published event out to
  // registered webhook endpoints and connected Slack/Teams/Discord
  // notification providers. Self-bootstrapping for the identical
  // reason registerAutomationTriggers() above already is.
  async () => {
    const { registerWebhookEventSubscriber } = await import("@/lib/services/webhooks");
    registerWebhookEventSubscriber();
  },
  // Billing, Plans & Feature Flags (Phase 8), Module 8.3 — reacts to
  // the SAME "payment.success"/"payment.failed" events Module 6.4
  // already publishes for every payment outcome, filtering to only
  // ones this module's own subscription-renewal checkouts created.
  async () => {
    const { registerBillingPaymentSubscriber } = await import("@/lib/services/billing");
    registerBillingPaymentSubscriber();
  },
];

let bootstrapped = false;
async function ensureBootstrapped(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  await Promise.all(bootstrappers.map((bootstrap) => bootstrap()));
}

export async function publish<TPayload = unknown>(
  eventType: string,
  payload: TPayload,
  options: PublishOptions = {},
): Promise<void> {
  await ensureBootstrapped();

  const event: DomainEvent<TPayload> = {
    id: randomUUID(),
    type: eventType,
    version: options.version ?? "1",
    payload,
    occurredAt: new Date().toISOString(),
    metadata: options.metadata,
  };

  // Every type-specific subscriber, plus every wildcard subscriber —
  // a handler that only cares about "lead.created" never sees the
  // wildcard list and vice versa, but both fire from one publish().
  const subscribers = [...(handlers.get(eventType) ?? []), ...(handlers.get(WILDCARD_EVENT_TYPE) ?? [])];

  logger.info("event.published", { eventId: event.id, eventType, subscriberCount: subscribers.length });

  await Promise.all(
    subscribers.map((handler) =>
      Promise.resolve(handler(event as DomainEvent)).catch((error) => {
        logger.error("event.handler_failed", {
          eventId: event.id,
          eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }),
    ),
  );
}

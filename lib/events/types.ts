/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * extends the pre-existing DomainEvent shape (previously just
 * `{type, payload, occurredAt}`) with the three fields a real
 * event-distribution layer needs that no publisher needed before now:
 *
 *  - `id`: a stable identifier so a delivery attempt, a delivery log
 *    row, and a "replay this failed event" action can all refer to the
 *    exact same occurrence — nothing before 6.5 needed to reference an
 *    event after the fact.
 *  - `version`: disambiguates payload shape if a future pass changes
 *    what a given event type carries — defaults to "1" for every
 *    existing and new publisher; nothing currently needs more than
 *    one version, this is the seam for when something does.
 *  - `metadata`: optional, free-form context (actorId, requestId,
 *    organizationId) a subscriber may want without it being part of
 *    the event's own business payload.
 *
 * Fully backward compatible: `publish()` populates `id`/`version`
 * itself (see eventBus.ts), so none of the four pre-existing
 * `publish(type, payload)` call sites need to change.
 */
export interface DomainEvent<TPayload = unknown> {
  id: string;
  type: string;
  version: string;
  payload: TPayload;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export type EventHandler<TPayload = unknown> = (event: DomainEvent<TPayload>) => Promise<void>;

/** Optional third argument to `publish()` — everything here is
 *  additive to the existing two-argument call shape. */
export interface PublishOptions {
  version?: string;
  metadata?: Record<string, unknown>;
}

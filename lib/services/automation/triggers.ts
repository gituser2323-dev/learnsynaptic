import { subscribe } from "@/lib/events";
import { getWorkflowRunRepository } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { startWorkflowRun } from "./engine";
import { listActiveDefinitionsByTrigger } from "./definitions";
import { autoReplyService } from "./autoReply";

const logger = createLogger({ service: "automation.triggers" });

/**
 * Every lib/events event type a persisted WorkflowDefinition (Module
 * 3.1) is allowed to trigger off today. A fixed, known list rather than
 * discovered from whatever's currently in the database — subscribe()
 * registrations happen once, at startup (see lib/events/eventBus.ts's
 * self-bootstrapping comment), before any persisted definition has been
 * read, so the set of event types this module can react to has to be
 * declared up front regardless of which definitions exist.
 *
 * "message.received" is deliberately NOT added here for Module 3.3
 * (Auto-Reply) — every definition on this list is hydrated and run as a
 * multi-step, per-Lead WorkflowRun (see handleTriggerEvent below), which
 * is the wrong shape for an immediate, synchronous reply to one inbound
 * message keyed by Conversation, not Lead. Auto-Reply gets its own
 * direct subscription below instead, matched against its own
 * AutoReplyRule catalog (./autoReply), not a WorkflowDefinition.
 *
 * "payment.success" (Phase 6, Module 6.4) — the mission's own explicit
 * "successful payments should be available as Automation triggers"
 * requirement, added the same way "lead.created" already works: a
 * matching WorkflowRun starts against the Lead the payment carried a
 * leadId for. A payment with no leadId yet is silently skipped by
 * handleTriggerEvent's own missing-entity-id guard below, the same
 * graceful degradation every other trigger already has.
 */
const SUPPORTED_TRIGGER_EVENT_TYPES = ["lead.created", "payment.success"];

let registered = false;

async function handleTriggerEvent(eventType: string, payload: { leadId?: string; entityId?: string }): Promise<void> {
  const entityId = payload.leadId ?? payload.entityId;
  if (!entityId) {
    logger.warn("automation.trigger_missing_entity_id", { eventType });
    return;
  }

  const definitions = await listActiveDefinitionsByTrigger(eventType);
  for (const definition of definitions) {
    await startWorkflowRun(definition.id, "Lead", entityId, payload as Record<string, unknown>);
  }
}

/**
 * Wires every SUPPORTED_TRIGGER_EVENT_TYPES entry to a live lookup of
 * matching active WorkflowDefinitions (querying the database fresh on
 * every event, not a cached snapshot — an admin toggling a definition
 * inactive or editing its steps takes effect on the very next event,
 * with no redeploy), plus one cross-cutting rule this module needs
 * regardless of which specific workflow is running: a
 * "registration.created" event for a lead stops any of that lead's
 * still-active workflow runs early — the "Student Conversion" step in
 * the requested diagram, modeled as an event-driven exit rather than a
 * literal action step (see the migrated lead-nurture-sequence
 * definition's own description for the reasoning).
 *
 * Called by lib/events/eventBus.ts's self-bootstrapping publish() path,
 * not from an instrumentation.ts hook — see that file's own doc comment
 * for why (a module-graph-splitting pitfall a startup hook can't avoid).
 * Idempotent — safe to call more than once in case a serverless
 * environment ever invokes it twice; a second call is a no-op rather
 * than double-registering every subscription.
 */
export function registerAutomationTriggers(): void {
  if (registered) return;
  registered = true;

  for (const eventType of SUPPORTED_TRIGGER_EVENT_TYPES) {
    subscribe(eventType, async (event) => {
      await handleTriggerEvent(eventType, event.payload as { leadId?: string; entityId?: string });
    });
  }

  subscribe("registration.created", async (event) => {
    const payload = event.payload as { leadId?: string };
    if (!payload.leadId) return;

    const repository = await getWorkflowRunRepository();
    const activeRuns = await repository.findActiveByEntity("Lead", payload.leadId);
    for (const run of activeRuns) {
      await repository.update(run.id, { status: "completed", completionReason: "converted" });
      logger.info("automation.workflow_stopped_on_conversion", { runId: run.id, leadId: payload.leadId });
    }
  });

  // Module 3.3 — Auto-Reply Engine. Published by
  // conversationService.recordInboundMessage() on every inbound
  // WhatsApp message (2.1), subscribed to by nothing until now. Never
  // fires for an auto-reply's own send — sendReply()/linkOutboundMessage()
  // never publish this event, so there's no self-triggering loop.
  subscribe("message.received", async (event) => {
    const payload = event.payload as { conversationId: string; messageId: string; body?: string };
    await autoReplyService.handleInboundMessage(payload);
  });
}

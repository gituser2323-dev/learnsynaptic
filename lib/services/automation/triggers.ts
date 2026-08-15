import { subscribe } from "@/lib/events";
import { getWorkflowRunRepository, getLeadRepository } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { runCrossTenantSweep, runWithTenantContext } from "@/lib/tenancy/context";
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
 *
 * "appointment.booked"/"appointment.confirmed"/"appointment.completed"/
 * "appointment.cancelled"/"appointment.no_show" (Appointment Booking, the
 * Growth-track module after Lead Capture) — every one of these is
 * published with a `leadId` (an Appointment always references a real
 * CRM Lead, see publicBookingService.book/appointmentService.updateStatus),
 * so they slot into this same generic Lead-scoped lookup with zero
 * engine changes, identically to how "payment.success" was added on top
 * of "lead.created" one phase earlier.
 */
const SUPPORTED_TRIGGER_EVENT_TYPES = [
  "lead.created",
  "payment.success",
  "appointment.booked",
  "appointment.confirmed",
  "appointment.completed",
  "appointment.cancelled",
  "appointment.no_show",
];

let registered = false;

/**
 * RC-9 — Full-System Validation, Load, Stress, Security & Failure
 * Testing. A real, live-proven CRITICAL cross-tenant bug found and
 * fixed this pass. `publish()` (lib/events/eventBus.ts) runs every
 * subscriber with WHATEVER tenant context (if any) was active at the
 * moment of the triggering write — and several of this app's own
 * genuinely public, unauthenticated routes (`POST /api/leads`, `POST
 * /api/registrations`) establish NO tenant context at all (see
 * withApiRoute.ts's own doc comment on why — there is no session to
 * derive one from). `listActiveDefinitionsByTrigger()`'s underlying
 * query is tenant-scoped via `tenantScopePlugin`, which is a **no-op**
 * with no context active (tenantScopePlugin.ts's own doc comment) — so
 * calling it with no context returned EVERY organization's active
 * definition for this trigger type, not none. `startWorkflowRun()` was
 * then called for EACH of them against the same entityId, with no
 * check that the entity actually belongs to that definition's own
 * organization.
 *
 * Confirmed live: a `WorkflowDefinition` belonging to "RC9 Organization
 * A" fired against Leads created through the real public lead-capture
 * endpoint (which stamp the deployment's own DEFAULT organization, not
 * "RC9 Organization A") — Organization A's own configured automation
 * ran using another organization's lead data it was never entitled to
 * see. The resulting `WorkflowRun` documents were created with **no
 * `organizationId` at all** (tenantScopePlugin's own `pre("save")`
 * hook only stamps one when a context is active — with none, it does
 * nothing), leaving them orphaned: invisible to every tenant-scoped
 * query, including the very organization whose automation ran.
 *
 * Fixed with the exact pattern this codebase already established for
 * this precise "an event/job has no ambient tenant context of its own,
 * but must ultimately touch tenant-owned data safely" shape (see
 * `runCrossTenantSweep()`'s own doc comment, used by
 * `schedulerService.ts` for the identical reason): look up matching
 * definitions via a deliberate cross-tenant sweep (so this step
 * genuinely sees every organization's own configured automation, not
 * silently zero), then — for each candidate — establish that
 * definition's OWN real tenant context and, within it, confirm the
 * target entity genuinely belongs to that SAME organization (a
 * tenant-scoped lookup that returns null for a cross-tenant or
 * no-tenant entity, the same "cross-tenant id behaves like not-found"
 * convention this app already holds everywhere else) before ever
 * starting a run. A Lead that belongs to a different organization (or
 * no organization at all, the exact public-lead-capture shape) now
 * correctly triggers NOTHING for a definition it doesn't belong to.
 */
async function handleTriggerEvent(eventType: string, payload: { leadId?: string; entityId?: string }): Promise<void> {
  const entityId = payload.leadId ?? payload.entityId;
  if (!entityId) {
    logger.warn("automation.trigger_missing_entity_id", { eventType });
    return;
  }

  const definitions = await runCrossTenantSweep(() => listActiveDefinitionsByTrigger(eventType));
  for (const definition of definitions) {
    if (!definition.organizationId) {
      // A definition with no organizationId of its own predates
      // tenant-scoping (Module 8.1) or was created outside any tenant
      // context — there is no safe organization to run it as. Skipped,
      // not silently run unscoped.
      logger.warn("automation.trigger_definition_missing_org", { eventType, workflowId: definition.id });
      continue;
    }
    await runWithTenantContext({ organizationId: definition.organizationId }, async () => {
      const leadRepository = await getLeadRepository();
      const entity = await leadRepository.findById(entityId);
      if (!entity) {
        // The tenant-scoped lookup found nothing — this entity does
        // NOT belong to this definition's own organization (or
        // belongs to none at all, e.g. a public-lead-capture Lead
        // stamped to the deployment's default org). Never start a run
        // using another organization's own configured automation
        // against data it was never entitled to see.
        return;
      }
      await startWorkflowRun(definition.id, "Lead", entityId, payload as Record<string, unknown>);
    });
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

  // RC-9 — the same cross-tenant gap handleTriggerEvent's own doc
  // comment describes, in a second real subscriber: "registration.created"
  // fires with no tenant context on this app's own genuinely public
  // registration route, so an unscoped findActiveByEntity()/update()
  // pair here could read AND MUTATE (marking "completed") another
  // organization's own WorkflowRun for a leadId this event's own
  // payload happened to name. Fixed the same way: resolve the Lead's
  // own real organization first (a deliberate cross-tenant lookup,
  // since none is known yet), then do the actual read+mutate inside
  // that organization's own real tenant context — never unscoped.
  subscribe("registration.created", async (event) => {
    const payload = event.payload as { leadId?: string };
    if (!payload.leadId) return;

    const leadRepository = await getLeadRepository();
    const lead = await runCrossTenantSweep(() => leadRepository.findById(payload.leadId!));
    if (!lead?.organizationId) return;

    await runWithTenantContext({ organizationId: lead.organizationId }, async () => {
      const repository = await getWorkflowRunRepository();
      const activeRuns = await repository.findActiveByEntity("Lead", payload.leadId!);
      for (const run of activeRuns) {
        await repository.update(run.id, { status: "completed", completionReason: "converted" });
        logger.info("automation.workflow_stopped_on_conversion", { runId: run.id, leadId: payload.leadId });
      }
    });
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

import { describe, it, expect } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { publish } from "@/lib/events";
import { registerAutomationTriggers } from "./triggers";
import { createWorkflowDefinition } from "./definitions";
import { getWorkflowRunRepository, getLeadRepository } from "@/lib/db";
import { leadService } from "@/lib/services/leads";

/**
 * RC-9 — Full-System Validation, Load, Stress, Security & Failure
 * Testing. Regression coverage for a real, live-proven CRITICAL
 * cross-tenant bug (triggers.ts's own doc comment on
 * `handleTriggerEvent` has the full finding): an event published with
 * NO ambient tenant context (the real shape of every genuinely public,
 * unauthenticated route — lead capture, registration) used to let
 * EVERY organization's own active "lead.created" WorkflowDefinition
 * fire against the triggering Lead, regardless of which organization
 * actually owned it — confirmed live: Organization A's own configured
 * automation ran using a different organization's real lead data.
 */
describe("automation triggers — cross-tenant isolation on event-triggered workflows", () => {
  registerAutomationTriggers();

  it("a WorkflowDefinition belonging to Org A never fires for a Lead that belongs to Org B", async () => {
    const orgA = `org-trigger-a-${Date.now()}`;
    const orgB = `org-trigger-b-${Date.now()}`;

    const defResult = await runWithTenantContext({ organizationId: orgA }, () =>
      createWorkflowDefinition({
        id: `wf-${orgA}`,
        name: "Org A lead nurture",
        triggerEventType: "lead.created",
        active: true,
        steps: [{ id: "step-1", action: { type: "add_tag", params: { tagId: "org-a-only" } } }],
      }),
    );
    expect(defResult.success).toBe(true);

    const leadResult = await runWithTenantContext({ organizationId: orgB }, () =>
      leadService.registerLead({ name: "Org B Lead", email: `org-b-lead-${Date.now()}@example.com`, phone: "+919800000020", source: "unit-test" }),
    );
    if (!leadResult.success) throw new Error(`seed lead failed: ${JSON.stringify(leadResult.errors)}`);
    const orgBLeadId = leadResult.lead.id;

    // Publish the event the same way the real route does: WITH Org B's
    // own context active this time (a normal, correctly-scoped
    // lead.created from inside an authenticated Org B session) — the
    // meaningful assertion is still that Org A's definition, which
    // does NOT own this lead, never fires for it.
    await runWithTenantContext({ organizationId: orgB }, () => publish("lead.created", { leadId: orgBLeadId }));

    const runRepository = await getWorkflowRunRepository();
    const runsForThisLead = await runWithTenantContext({ organizationId: orgA }, () => runRepository.findActiveByEntity("Lead", orgBLeadId));
    expect(runsForThisLead).toHaveLength(0);

    // And the lead itself was never mutated by Org A's own action (add_tag).
    const leadRepository = await getLeadRepository();
    const finalLead = await runWithTenantContext({ organizationId: orgB }, () => leadRepository.findById(orgBLeadId));
    expect(finalLead?.tags ?? []).not.toContain("org-a-only");
  });

  it("a WorkflowDefinition belonging to Org A never fires for a Lead with NO organization at all (the real public-lead-capture shape)", async () => {
    const orgA = `org-trigger-noorg-a-${Date.now()}`;
    const defResult = await runWithTenantContext({ organizationId: orgA }, () =>
      createWorkflowDefinition({
        id: `wf-noorg-${orgA}`,
        name: "Org A lead nurture (no-org probe)",
        triggerEventType: "lead.created",
        active: true,
        steps: [{ id: "step-1", action: { type: "add_tag", params: { tagId: "org-a-only" } } }],
      }),
    );
    expect(defResult.success).toBe(true);

    // No tenant context at all — the exact shape of a genuinely public,
    // unauthenticated lead-capture request.
    const leadResult = await leadService.registerLead({ name: "No Org Lead", email: `no-org-lead-${Date.now()}@example.com`, phone: "+919800000021", source: "unit-test" });
    if (!leadResult.success) throw new Error(`seed lead failed: ${JSON.stringify(leadResult.errors)}`);
    const noOrgLeadId = leadResult.lead.id;

    await publish("lead.created", { leadId: noOrgLeadId });

    const runRepository = await getWorkflowRunRepository();
    const runsForThisLead = await runWithTenantContext({ organizationId: orgA }, () => runRepository.findActiveByEntity("Lead", noOrgLeadId));
    expect(runsForThisLead).toHaveLength(0);
  });

  it("a WorkflowDefinition DOES correctly fire for a Lead that genuinely belongs to the SAME organization (the fix doesn't break the real, legitimate case)", async () => {
    const orgC = `org-trigger-same-${Date.now()}`;
    const defResult = await runWithTenantContext({ organizationId: orgC }, () =>
      createWorkflowDefinition({
        id: `wf-${orgC}`,
        name: "Org C lead nurture",
        triggerEventType: "lead.created",
        active: true,
        steps: [{ id: "step-1", action: { type: "add_tag", params: { tagId: "welcomed" } } }],
      }),
    );
    expect(defResult.success).toBe(true);

    const leadResult = await runWithTenantContext({ organizationId: orgC }, () =>
      leadService.registerLead({ name: "Org C Lead", email: `org-c-lead-${Date.now()}@example.com`, phone: "+919800000022", source: "unit-test" }),
    );
    if (!leadResult.success) throw new Error(`seed lead failed: ${JSON.stringify(leadResult.errors)}`);
    const leadId = leadResult.lead.id;

    await runWithTenantContext({ organizationId: orgC }, () => publish("lead.created", { leadId }));

    const runRepository = await getWorkflowRunRepository();
    const runs = await runWithTenantContext({ organizationId: orgC }, () => runRepository.findActiveByEntity("Lead", leadId));
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].organizationId).toBe(orgC);
  });
});

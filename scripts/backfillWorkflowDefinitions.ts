import { createWorkflowDefinition, getWorkflowDefinitionRecord } from "@/lib/services/automation";

/**
 * Automation Platform (Phase 3), Module 3.1 — one-time migration.
 * Persists the previously-hardcoded lead-nurture-sequence workflow
 * (formerly lib/services/automation/workflows/leadNurtureSequence.ts,
 * removed by this module) as a WorkflowDefinitionRecord with the exact
 * same id, trigger, steps, delays, retry policies, and action
 * parameters — "byte-identical output," the module's own Definition of
 * Done. Any WorkflowRun already in the database with
 * workflowId: "lead-nurture-sequence" keeps resolving correctly against
 * this record, since the id is unchanged.
 *
 * Idempotent — safe to re-run; a second run only reports the definition
 * already exists rather than erroring or duplicating it, the same
 * "safe to re-run" precedent scripts/backfillConversations.ts and
 * scripts/backfillLeadScores.ts already established.
 *
 * Usage:
 *   npx tsx scripts/backfillWorkflowDefinitions.ts
 */
async function main(): Promise<void> {
  const id = "lead-nurture-sequence";

  const existing = await getWorkflowDefinitionRecord(id);
  if (existing) {
    console.log(`Workflow definition "${id}" already exists — nothing to do.`);
    return;
  }

  const result = await createWorkflowDefinition({
    id,
    name: "Lead Registered -> Welcome -> Reminder -> Offer",
    triggerEventType: "lead.created",
    active: true,
    steps: [
      {
        id: "welcome-message",
        retryPolicy: { maxAttempts: 2, backoff: { amount: 15, unit: "minutes" } },
        action: {
          type: "send_whatsapp_template",
          params: {
            templateName: "lead_welcome_v1",
            variables: [{ field: "name", fallback: "there" }],
          },
        },
      },
      {
        id: "reminder",
        delay: { amount: 1, unit: "days" },
        retryPolicy: { maxAttempts: 3, backoff: { amount: 30, unit: "minutes" } },
        action: {
          type: "send_whatsapp_template",
          params: {
            templateName: "lead_reminder_v1",
            variables: [
              { field: "name", fallback: "there" },
              { field: "program", fallback: "your program" },
            ],
          },
        },
      },
      {
        id: "offer",
        delay: { amount: 2, unit: "days" },
        retryPolicy: { maxAttempts: 3, backoff: { amount: 30, unit: "minutes" } },
        condition: {
          type: "lead_not_registered",
          description: "Skip if this lead has already registered for a program",
        },
        action: {
          type: "send_whatsapp_template",
          params: {
            templateName: "lead_special_offer_v1",
            variables: [{ field: "name", fallback: "there" }],
          },
        },
      },
    ],
  });

  if (!result.success) {
    console.error("Failed to create workflow definition:", result.errors);
    process.exitCode = 1;
    return;
  }

  console.log(`Created workflow definition "${result.definition.id}" with ${result.definition.steps.length} step(s).`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});

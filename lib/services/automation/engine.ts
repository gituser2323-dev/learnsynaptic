import { getWorkflowRunRepository } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { publish } from "@/lib/events";
import type { PaginatedResult } from "@/lib/pagination";
import { getWorkflowDefinition } from "./definitions";
import { runCrossTenantSweep, runWithTenantContext, getTenantContext } from "@/lib/tenancy/context";
import { entitlementService, usageService, EntitlementError } from "@/lib/services/billing";
import { STALE_CLAIM_MS } from "./types";
import type {
  WorkflowContext,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunListFilters,
  WorkflowRunRepository,
  WorkflowStepDelay,
} from "./types";

const logger = createLogger({ service: "automation" });

const UNIT_MS: Record<WorkflowStepDelay["unit"], number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

function addDelay(base: Date, delay?: WorkflowStepDelay): Date {
  if (!delay) return base;
  return new Date(base.getTime() + UNIT_MS[delay.unit] * delay.amount);
}

/** Advances `run` to the next step (or to "completed" if there isn't
 *  one), applying that next step's delay to compute nextRunAt. Shared by
 *  both the "step executed successfully" and "step skipped by its
 *  condition" paths in advanceWorkflowRun() — both end the same way. */
async function moveToNextStep(
  run: WorkflowRun,
  definition: WorkflowDefinition,
  repository: WorkflowRunRepository,
): Promise<void> {
  const nextIndex = run.currentStepIndex + 1;
  const nextStep = definition.steps[nextIndex];
  const nextRunAt = nextStep ? addDelay(new Date(), nextStep.delay) : new Date();

  await repository.update(run.id, {
    currentStepIndex: nextIndex,
    status: nextStep ? "waiting" : "completed",
    nextRunAt: nextRunAt.toISOString(),
    attempts: 0,
    ...(nextStep ? {} : { completionReason: "sequence_finished" }),
  });

  if (!nextStep) {
    logger.info("automation.workflow_completed", { runId: run.id, reason: "sequence_finished" });
    await publish("workflow.completed", {
      runId: run.id,
      workflowId: run.workflowId,
      workflowName: definition.name,
      entityType: run.entityType,
      entityId: run.entityId,
      completionReason: "sequence_finished",
    });
  }
}

/** Creates a new, persisted WorkflowRun starting at step 0, due
 *  immediately — the trigger side of the trigger system (see
 *  triggers.ts, which calls this when a subscribed event fires). */
export async function startWorkflowRun(
  workflowId: string,
  entityType: string,
  entityId: string,
  context: Record<string, unknown>,
): Promise<WorkflowRun> {
  const repository = await getWorkflowRunRepository();
  const run = await repository.create({ workflowId, entityType, entityId, context });
  logger.info("automation.workflow_started", { workflowId, runId: run.id, entityType, entityId });
  await publish("workflow.started", { runId: run.id, workflowId, entityType, entityId });
  return run;
}

/**
 * Advances a single due WorkflowRun by exactly one step: evaluates the
 * step's condition (if any), executes it (if the condition allowed),
 * and either moves on, retries per the step's retryPolicy, or marks the
 * run permanently failed once retries are exhausted.
 *
 * This is the function a scheduled trigger calls (via
 * runDueWorkflowSteps() below) — it has no knowledge of what invoked it
 * (a cron-hit route, a manual test call, anything), the same
 * "queue-ready" seam lib/services/whatsapp/queue.ts's processSendJob()
 * uses for the same reason.
 *
 * RC-3 — the FIRST thing this function does is atomically claim `run`
 * (repository.claim(), the same double-execution-race fix
 * schedulerService.ts's own processJob() applies) — never proceeds on
 * the caller's own possibly-stale copy. A null claim (a concurrent
 * poller invocation already holds this run, or already advanced it
 * past this point) is a normal, silent no-op, not an error — see
 * WorkflowRunRepository.claim()'s own doc comment.
 */
export async function advanceWorkflowRun(run: WorkflowRun): Promise<void> {
  const repository = await getWorkflowRunRepository();

  const claimed = await repository.claim(run.id, new Date(Date.now() - STALE_CLAIM_MS));
  if (!claimed) {
    logger.info("automation.run_claim_lost", { runId: run.id, workflowId: run.workflowId });
    return;
  }
  run = claimed;

  const definition = await getWorkflowDefinition(run.workflowId);

  if (!definition) {
    logger.error("automation.unknown_workflow", { workflowId: run.workflowId, runId: run.id });
    await repository.update(run.id, { status: "failed", lastError: `Unknown workflow: ${run.workflowId}` });
    await publish("workflow.failed", { runId: run.id, workflowId: run.workflowId, entityType: run.entityType, entityId: run.entityId, error: `Unknown workflow: ${run.workflowId}` });
    return;
  }

  const step = definition.steps[run.currentStepIndex];
  if (!step) {
    await repository.update(run.id, { status: "completed", completionReason: "sequence_finished" });
    return;
  }

  const context: WorkflowContext = { entityType: run.entityType, entityId: run.entityId, data: run.context, runId: run.id };

  if (step.condition) {
    const shouldRun = await step.condition.evaluate(context);
    if (!shouldRun) {
      logger.info("automation.step_skipped", { runId: run.id, stepId: step.id, reason: step.condition.description });
      await moveToNextStep(run, definition, repository);
      return;
    }
  }

  // Business OS Phase 8, Module 8.3 — "one billable execution" is
  // defined as exactly one real `step.execute()` call about to happen
  // (never a step skipped by its own condition above, and never
  // double-counted per retry attempt within the same failed-then-
  // retried cycle — only this one call site, run once per attempt,
  // meters). Checked/incremented BEFORE execute() so a plan/limit
  // rejection never partially runs the step's own side effects (a
  // WhatsApp send, a task creation) — the mission's own "do not
  // partially execute paid actions." Reads ambient tenant context
  // (never a parameter) since `runDueWorkflowSteps()` already
  // establishes it per-run before calling this function; no context at
  // all (a direct, non-scheduler call in a test) fails open, the same
  // "no context means no enforcement is even meaningful" posture
  // `queue.ts`'s own identical check already established.
  const organizationId = getTenantContext()?.organizationId;
  if (organizationId) {
    try {
      await entitlementService.assertCapability(organizationId, "automation");
      const usage = await usageService.checkAndIncrementUsage(organizationId, "automation_executions");
      if (!usage.allowed) {
        const message = `Automation execution limit reached (${usage.current}/${usage.limit}) for this billing period.`;
        logger.warn("automation.execution_limit_exceeded", { runId: run.id, stepId: step.id, organizationId, ...usage });
        await repository.update(run.id, { status: "failed", lastError: message });
        await publish("workflow.failed", { runId: run.id, workflowId: run.workflowId, workflowName: definition.name, entityType: run.entityType, entityId: run.entityId, stepId: step.id, error: message });
        return;
      }
    } catch (error) {
      if (error instanceof EntitlementError) {
        logger.warn("automation.execution_denied", { runId: run.id, stepId: step.id, organizationId, code: error.code });
        await repository.update(run.id, { status: "failed", lastError: error.message });
        await publish("workflow.failed", { runId: run.id, workflowId: run.workflowId, workflowName: definition.name, entityType: run.entityType, entityId: run.entityId, stepId: step.id, error: error.message });
        return;
      }
      throw error;
    }
  }

  try {
    await step.execute(context);
    logger.info("automation.step_completed", { runId: run.id, stepId: step.id });
    await moveToNextStep(run, definition, repository);
  } catch (error) {
    const attempts = run.attempts + 1;
    const policy = step.retryPolicy ?? { maxAttempts: 1, backoff: { amount: 0, unit: "minutes" as const } };
    const message = error instanceof Error ? error.message : String(error);

    if (attempts >= policy.maxAttempts) {
      logger.error("automation.step_failed_final", { runId: run.id, stepId: step.id, attempts, error: message });
      await repository.update(run.id, { status: "failed", attempts, lastError: message });
      await publish("workflow.failed", {
        runId: run.id,
        workflowId: run.workflowId,
        workflowName: definition.name,
        entityType: run.entityType,
        entityId: run.entityId,
        stepId: step.id,
        error: message,
      });
    } else {
      const nextRunAt = addDelay(new Date(), { amount: policy.backoff.amount * attempts, unit: policy.backoff.unit });
      logger.warn("automation.step_retry_scheduled", {
        runId: run.id,
        stepId: step.id,
        attempts,
        maxAttempts: policy.maxAttempts,
        nextRunAt: nextRunAt.toISOString(),
        error: message,
      });
      await repository.update(run.id, {
        status: "waiting",
        attempts,
        lastError: message,
        nextRunAt: nextRunAt.toISOString(),
      });
    }
  }
}

/**
 * Processes every WorkflowRun that's currently due. Wired to run
 * automatically via the shared scheduler's own "automation.tick" job
 * (schedulerIntegration.ts, a self-rescheduling heartbeat), which in
 * turn runs on Vercel Cron's five-minute interval — see
 * schedulerService.ts's own runDueScheduledJobs() doc comment for the
 * full deployed-architecture picture RC-3 confirmed and hardened.
 */
export async function runDueWorkflowSteps(): Promise<{ processed: number }> {
  const repository = await getWorkflowRunRepository();

  // Business OS Phase 8, Module 8.1 — same shape as
  // schedulerService.ts's own runDueScheduledJobs: escape any tenant
  // context inherited from whatever triggered this tick (a real cron
  // hit has none; a manual admin trigger would otherwise silently
  // scope the sweep to just that admin's own organization's runs), then
  // resolve and enter each individual run's own real tenant context —
  // ONLY if it has one (see enqueueJob's own doc for why an unstamped
  // record runs with no forced context rather than a default) — before
  // advancing it.
  return runCrossTenantSweep(async () => {
    const due = await repository.findDue(new Date());
    for (const run of due) {
      if (run.organizationId) {
        await runWithTenantContext({ organizationId: run.organizationId }, () => advanceWorkflowRun(run));
      } else {
        await advanceWorkflowRun(run);
      }
    }
    return { processed: due.length };
  });
}

/** Admin Dashboard — Automation page: filtered/paginated run history. */
export async function listWorkflowRuns(
  filters: WorkflowRunListFilters,
  page: number,
  limit: number,
): Promise<PaginatedResult<WorkflowRun>> {
  const repository = await getWorkflowRunRepository();
  return repository.list(filters, page, limit);
}

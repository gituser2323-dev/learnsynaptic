import { enqueueJob, registerJobHandler } from "@/lib/services/scheduler";
import { runDueWorkflowSteps } from "./engine";

const TICK_JOB_TYPE = "automation.tick";

/** How often the Automation Engine re-checks for due WorkflowRuns —
 *  independent of any individual workflow step's own delay/backoff
 *  (those are tracked on WorkflowRun.nextRunAt and evaluated inside
 *  runDueWorkflowSteps() itself, exactly as before this file existed). */
const TICK_INTERVAL_MINUTES = 1;

/**
 * Bridges the Automation Engine onto the shared scheduler (Campaign
 * Architecture, approved decision 3 — one scheduling infrastructure,
 * no separate pollers) without changing anything about the engine
 * itself. `runDueWorkflowSteps()` (engine.ts, completely untouched)
 * already knows how to find and advance every due WorkflowRun in one
 * call — this only changes *what invokes it*: the shared queue instead
 * of a would-be independent cron entry.
 *
 * Always returns "reschedule": the engine manages its own per-step
 * retry/delay timing internally (advanceWorkflowRun() in engine.ts),
 * so from the shared scheduler's point of view this job is a heartbeat
 * that never "fails" — it just keeps re-arming itself every
 * TICK_INTERVAL_MINUTES.
 */
export function registerAutomationTickHandler(): void {
  registerJobHandler(TICK_JOB_TYPE, async () => {
    await runDueWorkflowSteps();
    return {
      result: "reschedule",
      runAt: new Date(Date.now() + TICK_INTERVAL_MINUTES * 60_000).toISOString(),
    };
  });
}

let tickEnsured = false;

/** Creates the first tick job if one hasn't been ensured yet this
 *  process — after that, each processed tick reschedules itself, so
 *  this only ever needs to run once. Mirrors triggers.ts's own
 *  `registered` guard for the same "might run more than once in some
 *  environment" caution. */
export async function ensureAutomationTickScheduled(): Promise<void> {
  if (tickEnsured) return;
  tickEnsured = true;
  await enqueueJob({ jobType: TICK_JOB_TYPE, payload: {}, runAt: new Date().toISOString() });
}

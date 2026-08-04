import { enqueueJob, registerJobHandler } from "@/lib/services/scheduler";
import { taskService } from "./taskService";

const TICK_JOB_TYPE = "crm.task_reminder_tick";

/** How often pending Task reminders are checked — independent of any
 *  individual task's own reminderAt (that's the poller's due-query, not
 *  this interval). Same self-rescheduling "heartbeat" shape as the
 *  Automation Engine's own tick (schedulerIntegration.ts in
 *  lib/services/automation) — reused deliberately, not reinvented. */
const TICK_INTERVAL_MINUTES = 5;

export function registerTaskReminderTickHandler(): void {
  registerJobHandler(TICK_JOB_TYPE, async () => {
    await taskService.processPendingReminders();
    return {
      result: "reschedule",
      runAt: new Date(Date.now() + TICK_INTERVAL_MINUTES * 60_000).toISOString(),
    };
  });
}

let tickEnsured = false;

export async function ensureTaskReminderTickScheduled(): Promise<void> {
  if (tickEnsured) return;
  tickEnsured = true;
  await enqueueJob({ jobType: TICK_JOB_TYPE, payload: {}, runAt: new Date().toISOString() });
}

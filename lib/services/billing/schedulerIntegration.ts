import { enqueueJob, registerJobHandler } from "@/lib/services/scheduler";
import { createLogger } from "@/lib/logger";
import { runCrossTenantSweep, runWithTenantContext } from "@/lib/tenancy/context";
import { subscriptionService } from "./subscriptionService";

const logger = createLogger({ service: "billing.period_check" });

const PERIOD_CHECK_JOB_TYPE = "billing.period_check";
const PERIOD_CHECK_INTERVAL_MINUTES = 60;

/** How long a `past_due` subscription stays active-equivalent (see
 *  `ACTIVE_SUBSCRIPTION_STATUSES`) before this job expires it — the
 *  mission's own "grace period extension point," made a concrete,
 *  real number here rather than left unimplemented. Extending this
 *  needs no schema change — it's read once, here. */
const PAST_DUE_GRACE_DAYS = 7;

/**
 * Business OS Phase 8, Module 8.3. Bridges onto the shared scheduler
 * exactly the way Module 2.3's template-sync/phone-health jobs and
 * Module 6.4's payments.reconcile job already do — a global,
 * no-organizationId job (`runDueScheduledJobs()` runs it with no
 * ambient tenant context, the same as `payments.reconcile`), so its own
 * handler does its own explicit cross-tenant sweep via
 * `runCrossTenantSweep()` before entering each individual
 * subscription's own tenant context to apply a transition — the exact
 * two-phase shape `runDueScheduledJobs`/`runDueWorkflowSteps`
 * themselves already establish at the scheduler-engine level, applied
 * here one level up for a billing-specific sweep.
 */
export function registerBillingPeriodCheckHandler(): void {
  registerJobHandler(PERIOD_CHECK_JOB_TYPE, async () => {
    const now = Date.now();
    const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

    const subscriptions = await runCrossTenantSweep(() => subscriptionService.listAllForScheduler());
    let trialsExpired = 0;
    let pastDueExpired = 0;
    let cancellationsApplied = 0;

    for (const subscription of subscriptions) {
      await runWithTenantContext({ organizationId: subscription.organizationId }, async () => {
        if (subscription.status === "trialing" && subscription.trialEndsAt && new Date(subscription.trialEndsAt).getTime() <= now) {
          await subscriptionService.expire(subscription.organizationId, "trial_ended");
          trialsExpired++;
          return;
        }
        if (subscription.status === "past_due" && new Date(subscription.currentPeriodEnd).getTime() + graceMs <= now) {
          await subscriptionService.expire(subscription.organizationId, "grace_period_ended");
          pastDueExpired++;
          return;
        }
        if (subscription.cancelAt && new Date(subscription.cancelAt).getTime() <= now && subscription.status !== "cancelled") {
          await subscriptionService.cancel(subscription.organizationId, { immediate: true });
          cancellationsApplied++;
        }
      });
    }

    logger.info("billing.period_check_completed", { checked: subscriptions.length, trialsExpired, pastDueExpired, cancellationsApplied });
    return { result: "reschedule", runAt: new Date(Date.now() + PERIOD_CHECK_INTERVAL_MINUTES * 60_000).toISOString() };
  });
}

let tickEnsured = false;

export async function ensureBillingPeriodCheckTickScheduled(): Promise<void> {
  if (tickEnsured) return;
  tickEnsured = true;
  await enqueueJob({ jobType: PERIOD_CHECK_JOB_TYPE, payload: {}, runAt: new Date().toISOString() });
}

import { enqueueJob, registerJobHandler } from "@/lib/services/scheduler";
import { createLogger } from "@/lib/logger";
import { paymentService } from "./paymentService";

const logger = createLogger({ service: "payments.reconcile" });

const RECONCILE_JOB_TYPE = "payments.reconcile";

/** Real robustness for a missed or never-delivered provider webhook —
 *  the mission's own "production-ready" framing, not decorative. Runs
 *  every 15 minutes; paymentService.reconcilePendingPayments() itself
 *  only ever queries payments genuinely stuck "created"/"pending" past
 *  30 minutes (see paymentService.ts's own STALE_PENDING_MINUTES), so
 *  a healthy webhook pipeline means this job's own real work is
 *  usually zero, not a redundant poll racing every webhook. */
const RECONCILE_INTERVAL_MINUTES = 15;

/**
 * Payments Integration (Phase 6), Module 6.4. Bridges onto the shared
 * scheduler exactly the way Module 2.3's own template-sync/phone-health
 * jobs already do — one more entry in the same "one scheduling
 * infrastructure, no separate pollers" precedent, not a second
 * mechanism.
 */
export function registerPaymentReconcileHandler(): void {
  registerJobHandler(RECONCILE_JOB_TYPE, async () => {
    const { checked, resolved } = await paymentService.reconcilePendingPayments();
    logger.info("payments.reconcile_completed", { checked, resolved });
    return { result: "reschedule", runAt: new Date(Date.now() + RECONCILE_INTERVAL_MINUTES * 60_000).toISOString() };
  });
}

let tickEnsured = false;

export async function ensurePaymentReconcileTickScheduled(): Promise<void> {
  if (tickEnsured) return;
  tickEnsured = true;
  await enqueueJob({ jobType: RECONCILE_JOB_TYPE, payload: {}, runAt: new Date().toISOString() });
}

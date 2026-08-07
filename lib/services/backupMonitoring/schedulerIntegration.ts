import { enqueueJob, registerJobHandler } from "@/lib/services/scheduler";
import { createLogger } from "@/lib/logger";
import { backupMonitoringService } from "./backupMonitoringService";

const logger = createLogger({ service: "backupMonitoring.freshnessCheck" });

const FRESHNESS_CHECK_JOB_TYPE = "backup.check_freshness";
const FRESHNESS_CHECK_INTERVAL_MINUTES = 6 * 60;

/**
 * RC-5 — global, no-organizationId job (same shape as
 * payments.reconcile/billing.period_check — see those modules' own
 * doc comments): backup coverage isn't per-tenant, it's whole-database.
 * Self-reschedules every 6 hours; alerts (via errorTrackingService, RC-3's
 * existing pipeline) whenever the most recent recorded backup is
 * missing, failed, or older than BACKUP_MAX_AGE_HOURS.
 */
export function registerBackupFreshnessCheckHandler(): void {
  registerJobHandler(FRESHNESS_CHECK_JOB_TYPE, async () => {
    const result = await backupMonitoringService.checkBackupFreshness();
    logger.info("backup.freshness_checked", { ok: result.ok, reason: result.reason });
    return { result: "reschedule", runAt: new Date(Date.now() + FRESHNESS_CHECK_INTERVAL_MINUTES * 60_000).toISOString() };
  });
}

let tickEnsured = false;

export async function ensureBackupFreshnessCheckScheduled(): Promise<void> {
  if (tickEnsured) return;
  tickEnsured = true;
  await enqueueJob({ jobType: FRESHNESS_CHECK_JOB_TYPE, payload: {}, runAt: new Date().toISOString() });
}

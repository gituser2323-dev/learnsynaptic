import { getBackupLogRepository } from "@/lib/db";
import { errorTrackingService } from "@/lib/services/errorTracking";
import { createLogger } from "@/lib/logger";
import type { BackupLog, CreateBackupLogInput } from "./types";

const logger = createLogger({ service: "backupMonitoring" });

/** How stale the most recent successful backup is allowed to get before
 *  this is treated as an overdue-backup incident. Set for a daily
 *  backup cadence (§3 of DR_RUNBOOK.md) with a real buffer for a
 *  slightly late run — not tuned to a faster cadence a real production
 *  deployment might choose; revisit alongside the retention policy if
 *  the backup schedule ever changes. */
const BACKUP_MAX_AGE_HOURS = 26;

export const backupMonitoringService = {
  /** RC-5 — called by scripts/db/backupDatabase.ts and
   *  scripts/db/verifyBackup.ts after every real run (success or
   *  failure) — this is what makes backup freshness/health auditable
   *  FROM WITHIN the app, not just from whatever external system
   *  triggered the backup (a manual run, a CI job, Atlas). A failure is
   *  ALSO reported immediately via the existing error-tracking pipeline
   *  (never a second notification platform) — this is deliberately not
   *  the same as the periodic freshness check below, which only fires
   *  for staleness, not for an immediately-known failure. */
  async recordBackupResult(input: CreateBackupLogInput): Promise<BackupLog> {
    const repository = await getBackupLogRepository();
    const entry = await repository.create(input);

    if (input.status === "failure") {
      await errorTrackingService.captureException(new Error(input.error ?? "Backup failed"), {
        operation: "backup.failed",
        severity: "error",
      });
    }

    logger.info("backup.recorded", { status: input.status, sizeBytes: input.sizeBytes, durationMs: input.durationMs });
    return entry;
  },

  /** RC-5 — "is the most recent backup missing or too old." Reports
   *  through errorTrackingService (RC-3's own webhook-based pipeline —
   *  whatever channel that's configured to reach, e.g. Slack/Discord/a
   *  generic webhook, is where this alert lands too) rather than a
   *  second, backup-specific alerting mechanism. */
  async checkBackupFreshness(): Promise<{ ok: boolean; reason?: string }> {
    const repository = await getBackupLogRepository();
    const latest = await repository.findLatest();

    if (!latest) {
      const reason = "No backup has ever been recorded.";
      await errorTrackingService.captureException(new Error(reason), { operation: "backup.overdue", severity: "warning" });
      return { ok: false, reason };
    }

    const ageHours = (Date.now() - new Date(latest.completedAt).getTime()) / (60 * 60 * 1000);
    if (latest.status === "failure") {
      const reason = `Most recent backup (${latest.completedAt}) failed: ${latest.error ?? "unknown error"}`;
      await errorTrackingService.captureException(new Error(reason), { operation: "backup.overdue", severity: "warning" });
      return { ok: false, reason };
    }
    if (ageHours > BACKUP_MAX_AGE_HOURS) {
      const reason = `Most recent successful backup is ${ageHours.toFixed(1)}h old (limit ${BACKUP_MAX_AGE_HOURS}h).`;
      await errorTrackingService.captureException(new Error(reason), { operation: "backup.overdue", severity: "warning" });
      return { ok: false, reason };
    }

    return { ok: true };
  },
};

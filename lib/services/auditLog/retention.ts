import { getAuditLogRepository } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { AUDIT_LOG_RETENTION_DAYS } from "@/config/auditLog";
import { noopArchiver, type AuditLogArchiver } from "./archiver";

const logger = createLogger({ service: "auditLog.retention" });

/**
 * Prunes AuditLog entries older than the configured retention window
 * (config/auditLog.ts, default 365 days).
 *
 * NOT wired to run automatically — no scheduler/cron infrastructure
 * exists in this app yet, and an unauthenticated route that deletes data
 * would be a worse gap than the ones already flagged on /api/campaigns
 * and /api/registrations. Call this from a future scheduled trigger
 * (Vercel Cron, an authenticated admin action) once one exists.
 *
 * Deliberately not implemented as a MongoDB TTL index: TTL deletion is
 * silent and automatic with no hook for archival, which would foreclose
 * the archival capability this function exists to support. `archiver`
 * runs BEFORE deletion, and deletion is skipped entirely if archiving
 * throws — losing data because the archive step failed would defeat the
 * point of archiving it.
 */
export async function pruneExpiredAuditLogs(
  archiver: AuditLogArchiver = noopArchiver,
  retentionDays: number = AUDIT_LOG_RETENTION_DAYS,
): Promise<{ archived: number; deleted: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const repository = await getAuditLogRepository();

  const expired = await repository.findOlderThan(cutoff);
  if (expired.length === 0) {
    return { archived: 0, deleted: 0 };
  }

  try {
    await archiver.archive(expired);
  } catch (error) {
    logger.error("audit.archive_failed", {
      count: expired.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const deleted = await repository.deleteByIds(expired.map((entry) => entry.id));
  logger.info("audit.pruned", { archived: expired.length, deleted, retentionDays });
  return { archived: expired.length, deleted };
}

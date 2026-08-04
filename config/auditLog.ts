/**
 * Single source of truth for audit-log retention. Server-only.
 *
 * Deliberately not enforced via a MongoDB TTL index — TTL deletion is
 * silent and automatic with no hook to archive an entry first, which
 * would foreclose future archival (see lib/services/auditLog/retention.ts).
 * This value instead parameterizes an application-level prune function
 * that archives before deleting.
 */

const DEFAULT_RETENTION_DAYS = 365;

function resolveRetentionDays(): number {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
}

export const AUDIT_LOG_RETENTION_DAYS = resolveRetentionDays();

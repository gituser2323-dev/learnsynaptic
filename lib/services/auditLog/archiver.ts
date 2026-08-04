import type { AuditLogEntry } from "@/lib/db";

/**
 * Runs before deletion in retention.ts's pruneExpiredAuditLogs() — the
 * extension point for real cold storage (S3, a separate "cold"
 * collection, etc.) once one is chosen.
 */
export interface AuditLogArchiver {
  archive(entries: AuditLogEntry[]): Promise<void>;
}

/**
 * Default archiver — does nothing. Pruned entries are deleted without
 * being copied anywhere first. This is the placeholder until a real
 * archive destination exists; swapping it is a one-file change, the same
 * provider-swap pattern used by lib/services/whatsapp's vendor adapters.
 */
export const noopArchiver: AuditLogArchiver = {
  async archive(): Promise<void> {
    // Intentionally a no-op.
  },
};

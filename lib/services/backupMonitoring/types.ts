/**
 * RC-5 — Backup, Restore & Disaster Recovery: backup monitoring.
 * System-level, not tenant-owned data (same category as ScheduledJob —
 * see tenantScopePlugin.ts's own doc comment on why User/RefreshToken/
 * Organization/ScheduledJob are deliberately not tenant-scoped) — a
 * backup covers the whole database, not one organization.
 */

export type BackupLogStatus = "success" | "failure";

export interface BackupLog {
  id: string;
  status: BackupLogStatus;
  completedAt: string;
  sizeBytes?: number;
  durationMs?: number;
  /** Set only on status: "failure" — never a raw error object, just a
   *  short message (same "safe metadata only" discipline
   *  errorTrackingService's own doc comment establishes). */
  error?: string;
  createdAt: string;
}

export interface CreateBackupLogInput {
  status: BackupLogStatus;
  completedAt: string;
  sizeBytes?: number;
  durationMs?: number;
  error?: string;
}

export interface BackupLogRepository {
  create(input: CreateBackupLogInput): Promise<BackupLog>;
  findLatest(): Promise<BackupLog | null>;
}

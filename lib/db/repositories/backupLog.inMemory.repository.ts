import { randomUUID } from "crypto";
import type { BackupLog, BackupLogRepository, CreateBackupLogInput } from "@/lib/services/backupMonitoring/types";

const store: BackupLog[] = [];

export const inMemoryBackupLogRepository: BackupLogRepository = {
  async create(input: CreateBackupLogInput): Promise<BackupLog> {
    const entry: BackupLog = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    store.push(entry);
    return entry;
  },

  async findLatest(): Promise<BackupLog | null> {
    if (store.length === 0) return null;
    return [...store].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  },
};

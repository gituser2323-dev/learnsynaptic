import { getConnection } from "@/lib/db/connection";
import { BackupLogModel, toBackupLog } from "@/lib/db/models/backupLog.model";
import type { BackupLog, BackupLogRepository, CreateBackupLogInput } from "@/lib/services/backupMonitoring/types";

export const mongodbBackupLogRepository: BackupLogRepository = {
  async create(input: CreateBackupLogInput): Promise<BackupLog> {
    await getConnection();
    const doc = await BackupLogModel.create(input);
    return toBackupLog(doc);
  },

  async findLatest(): Promise<BackupLog | null> {
    await getConnection();
    const doc = await BackupLogModel.findOne().sort({ completedAt: -1 }).exec();
    return doc ? toBackupLog(doc) : null;
  },
};

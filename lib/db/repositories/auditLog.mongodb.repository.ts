import type { ClientSession } from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { AuditLogModel, toAuditLogEntry } from "@/lib/db/models/auditLog.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type { AuditEntityType, AuditLogEntry, AuditLogListFilters, AuditLogRepository, CreateAuditLogInput } from "./types";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const mongodbAuditLogRepository: AuditLogRepository = {
  async record(input: CreateAuditLogInput, session?: ClientSession): Promise<AuditLogEntry> {
    await getConnection();
    const [doc] = await AuditLogModel.create([input], { session });
    return toAuditLogEntry(doc);
  },

  async findByEntity(entityType: AuditEntityType, entityId: string): Promise<AuditLogEntry[]> {
    await getConnection();
    const docs = await AuditLogModel.find({ entityType, entityId }).sort({ createdAt: -1 }).exec();
    return docs.map(toAuditLogEntry);
  },

  async findOlderThan(cutoff: Date): Promise<AuditLogEntry[]> {
    await getConnection();
    const docs = await AuditLogModel.find({ createdAt: { $lt: cutoff } }).exec();
    return docs.map(toAuditLogEntry);
  },

  async deleteByIds(ids: string[]): Promise<number> {
    await getConnection();
    const result = await AuditLogModel.deleteMany({ _id: { $in: ids } }).exec();
    return result.deletedCount ?? 0;
  },

  async list(filters: AuditLogListFilters, page: number, limit: number): Promise<PaginatedResult<AuditLogEntry>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.category) query.category = filters.category;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.action) query.action = filters.action;
    if (filters.search) {
      const regex = new RegExp(escapeRegex(filters.search), "i");
      query.$or = [{ entityId: regex }, { action: regex }];
    }

    const [docs, total] = await Promise.all([
      AuditLogModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      AuditLogModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toAuditLogEntry), total, { page, limit });
  },
};

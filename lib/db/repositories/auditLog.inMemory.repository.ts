import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type { AuditEntityType, AuditLogEntry, AuditLogListFilters, AuditLogRepository, CreateAuditLogInput } from "./types";

const store: AuditLogEntry[] = [];

export const inMemoryAuditLogRepository: AuditLogRepository = {
  async record(input: CreateAuditLogInput): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = stampTenant<AuditLogEntry>({
      ...input,
      actorType: input.actorType ?? "system",
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    });
    store.push(entry);
    return entry;
  },

  async findByEntity(entityType: AuditEntityType, entityId: string): Promise<AuditLogEntry[]> {
    return scopeToTenant(store)
      .filter((e) => e.entityType === entityType && e.entityId === entityId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // Business OS Phase 8, Module 8.1 — deliberately NOT scoped: the
  // retention/pruning job (auditLog/retention.ts's pruneExpiredAuditLogs)
  // is a system-wide sweep by its own nature (this codebase has one
  // retention policy, not a per-org one), the same category as
  // findDue/findStalePending elsewhere in this pass.
  async findOlderThan(cutoff: Date): Promise<AuditLogEntry[]> {
    return store.filter((e) => new Date(e.createdAt) < cutoff);
  },

  async deleteByIds(ids: string[]): Promise<number> {
    const idSet = new Set(ids);
    let deletedCount = 0;
    for (let i = store.length - 1; i >= 0; i--) {
      if (idSet.has(store[i].id)) {
        store.splice(i, 1);
        deletedCount++;
      }
    }
    return deletedCount;
  },

  async list(filters: AuditLogListFilters, page: number, limit: number): Promise<PaginatedResult<AuditLogEntry>> {
    let results = scopeToTenant(store);
    if (filters.category) results = results.filter((e) => e.category === filters.category);
    if (filters.entityType) results = results.filter((e) => e.entityType === filters.entityType);
    if (filters.action) results = results.filter((e) => e.action === filters.action);
    if (filters.search) {
      const query = filters.search.toLowerCase();
      results = results.filter(
        (e) => e.entityId.toLowerCase().includes(query) || e.action.toLowerCase().includes(query),
      );
    }
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },
};

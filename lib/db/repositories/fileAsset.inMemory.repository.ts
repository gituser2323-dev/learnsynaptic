import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateFileAssetInput,
  FileAsset,
  FileAssetListFilters,
  FileAssetRepository,
} from "@/lib/services/storage/types";

const store: FileAsset[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryFileAssetRepository: FileAssetRepository = {
  async findById(id: string): Promise<FileAsset | null> {
    return findOwnedByTenant(store, (f) => f.id === id) ?? null;
  },

  async create(input: CreateFileAssetInput): Promise<FileAsset> {
    const file: FileAsset = stampTenant({ ...input, id: randomUUID(), createdAt: nowIso(), updatedAt: nowIso() });
    store.push(file);
    return file;
  },

  async list(filters: FileAssetListFilters, page: number, limit: number): Promise<PaginatedResult<FileAsset>> {
    let results = scopeToTenant(store);
    if (filters.relatedEntityType) results = results.filter((f) => f.relatedEntityType === filters.relatedEntityType);
    if (filters.relatedEntityId) results = results.filter((f) => f.relatedEntityId === filters.relatedEntityId);
    if (filters.category) results = results.filter((f) => f.category === filters.category);
    if (!filters.includeDeleted) results = results.filter((f) => !f.deletedAt);
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async softDelete(id: string): Promise<FileAsset> {
    const file = findOwnedByTenant(store, (f) => f.id === id);
    if (!file) throw new Error(`FileAsset ${id} not found`);
    file.deletedAt = nowIso();
    file.updatedAt = nowIso();
    return file;
  },
};

import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateIntegrationLogInput,
  IntegrationLog,
  IntegrationLogListFilters,
  IntegrationLogRepository,
} from "@/lib/services/integrations/types";

const store: IntegrationLog[] = [];

export const inMemoryIntegrationLogRepository: IntegrationLogRepository = {
  async create(input: CreateIntegrationLogInput): Promise<IntegrationLog> {
    const log: IntegrationLog = stampTenant<IntegrationLog>({ ...input, id: randomUUID(), createdAt: new Date().toISOString() });
    store.push(log);
    return log;
  },

  async list(filters: IntegrationLogListFilters, page: number, limit: number): Promise<PaginatedResult<IntegrationLog>> {
    const results = scopeToTenant(store).filter((l) => l.providerId === filters.providerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },
};

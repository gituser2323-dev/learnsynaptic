import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateLeadInsightInput,
  LeadInsight,
  LeadInsightListFilters,
  LeadInsightRepository,
} from "@/lib/services/crm/leadInsights/types";

const store: LeadInsight[] = [];

export const inMemoryLeadInsightRepository: LeadInsightRepository = {
  async create(input: CreateLeadInsightInput): Promise<LeadInsight> {
    const insight: LeadInsight = stampTenant<LeadInsight>({ ...input, id: randomUUID(), createdAt: new Date().toISOString() });
    store.push(insight);
    return insight;
  },

  async list(filters: LeadInsightListFilters, page: number, limit: number): Promise<PaginatedResult<LeadInsight>> {
    const results = scopeToTenant(store).filter((i) => i.leadId === filters.leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async findLatest(leadId: string): Promise<LeadInsight | null> {
    const results = scopeToTenant(store).filter((i) => i.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return results[0] ?? null;
  },
};

import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  ConversationInsight,
  ConversationInsightListFilters,
  ConversationInsightRepository,
  CreateConversationInsightInput,
} from "@/lib/services/conversations/insights/types";

const store: ConversationInsight[] = [];

export const inMemoryConversationInsightRepository: ConversationInsightRepository = {
  async create(input: CreateConversationInsightInput): Promise<ConversationInsight> {
    const insight: ConversationInsight = stampTenant<ConversationInsight>({ ...input, id: randomUUID(), createdAt: new Date().toISOString() });
    store.push(insight);
    return insight;
  },

  async list(filters: ConversationInsightListFilters, page: number, limit: number): Promise<PaginatedResult<ConversationInsight>> {
    const results = scopeToTenant(store)
      .filter((i) => i.conversationId === filters.conversationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async findLatest(conversationId: string): Promise<ConversationInsight | null> {
    const results = scopeToTenant(store).filter((i) => i.conversationId === conversationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return results[0] ?? null;
  },

  async listForLead(leadId: string, limit: number): Promise<ConversationInsight[]> {
    return scopeToTenant(store)
      .filter((i) => i.leadId === leadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },
};

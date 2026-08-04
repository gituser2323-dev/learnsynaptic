import { randomUUID } from "crypto";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateOpportunityInput,
  Opportunity,
  OpportunityListFilters,
  OpportunityRepository,
  OpportunityStageHistoryEntry,
  UpdateOpportunityInput,
} from "@/lib/services/crm/pipelines/types";

const store: Opportunity[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryOpportunityRepository: OpportunityRepository = {
  async findById(id: string): Promise<Opportunity | null> {
    return findOwnedByTenant(store, (o) => o.id === id) ?? null;
  },

  async create(input: CreateOpportunityInput): Promise<Opportunity> {
    const opportunity: Opportunity = stampTenant({
      ...input,
      id: randomUUID(),
      status: "open",
      probability: input.probability ?? 50,
      stageHistory: [{ stageId: input.stageId, enteredAt: nowIso() }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(opportunity);
    return opportunity;
  },

  async update(id: string, input: UpdateOpportunityInput): Promise<Opportunity> {
    const opportunity = findOwnedByTenant(store, (o) => o.id === id);
    if (!opportunity) throw new Error(`Opportunity ${id} not found`);
    Object.assign(opportunity, input, { updatedAt: nowIso() });
    if (input.stageId) {
      opportunity.stageHistory = [...opportunity.stageHistory, { stageId: input.stageId, enteredAt: nowIso() }];
    }
    return opportunity;
  },

  async list(filters: OpportunityListFilters): Promise<Opportunity[]> {
    return scopeToTenant(store)
      .filter((o) => {
        if (filters.pipelineId && o.pipelineId !== filters.pipelineId) return false;
        if (filters.stageId && o.stageId !== filters.stageId) return false;
        if (filters.status && o.status !== filters.status) return false;
        if (filters.ownerId && o.ownerId !== filters.ownerId) return false;
        if (filters.leadId && o.leadId !== filters.leadId) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async seedStageHistory(id: string, entry: OpportunityStageHistoryEntry): Promise<void> {
    const opportunity = findOwnedByTenant(store, (o) => o.id === id);
    if (!opportunity) throw new Error(`Opportunity ${id} not found`);
    opportunity.stageHistory = [entry];
  },
};

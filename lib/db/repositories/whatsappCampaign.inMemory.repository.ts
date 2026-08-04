import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateWhatsAppCampaignInput,
  WhatsAppCampaign,
  WhatsAppCampaignListFilters,
  WhatsAppCampaignRepository,
} from "@/lib/services/whatsappCampaigns/types";

const store: WhatsAppCampaign[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryWhatsAppCampaignRepository: WhatsAppCampaignRepository = {
  async create(input: CreateWhatsAppCampaignInput): Promise<WhatsAppCampaign> {
    const campaign: WhatsAppCampaign = stampTenant<WhatsAppCampaign>({
      ...input,
      status: "draft",
      recipientCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      replyCount: 0,
      clickCount: 0,
      archived: false,
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(campaign);
    return campaign;
  },

  async findById(id: string): Promise<WhatsAppCampaign | null> {
    return findOwnedByTenant(store, (c) => c.id === id) ?? null;
  },

  async list(
    filters: WhatsAppCampaignListFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<WhatsAppCampaign>> {
    let results = scopeToTenant(store).filter((c) => c.archived === (filters.archived ?? false));
    if (filters.status) results = results.filter((c) => c.status === filters.status);
    if (filters.search) {
      const query = filters.search.toLowerCase();
      results = results.filter((c) => c.name.toLowerCase().includes(query));
    }
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async update(id, patch): Promise<WhatsAppCampaign> {
    const campaign = findOwnedByTenant(store, (c) => c.id === id);
    if (!campaign) throw new Error(`WhatsAppCampaign ${id} not found`);
    Object.assign(campaign, patch, { updatedAt: nowIso() });
    return campaign;
  },

  async incrementCounts(id, delta): Promise<WhatsAppCampaign> {
    const campaign = findOwnedByTenant(store, (c) => c.id === id);
    if (!campaign) throw new Error(`WhatsAppCampaign ${id} not found`);
    for (const [key, value] of Object.entries(delta)) {
      if (!value) continue;
      const field = key as keyof typeof delta;
      campaign[field] = (campaign[field] ?? 0) + value;
    }
    campaign.updatedAt = nowIso();
    return campaign;
  },

  // Business OS Phase 8, Module 8.1 — deliberately NOT scoped to the
  // active tenant, matching workflowRun.inMemory.repository.ts's own
  // findDue precedent: this is a "find every due item across every
  // organization" shape meant for a scheduler sweep to pick up (no
  // caller wires it to a scheduler yet, but the name/shape and its
  // mongodb.repository.ts sibling both signal it's meant as one). If a
  // scheduler is later wired to this, it must resolve each found
  // campaign's own organizationId and enter that campaign's own
  // tenant context before processing it, the same way engine.ts does
  // for WorkflowRun.
  async findDueScheduled(now: Date): Promise<WhatsAppCampaign[]> {
    return store.filter(
      (c) => c.status === "scheduled" && c.scheduledFor && new Date(c.scheduledFor).getTime() <= now.getTime(),
    );
  },
};

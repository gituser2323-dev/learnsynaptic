import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type { Campaign, CampaignListFilters, CampaignRepository, CreateCampaignInput } from "./types";

/**
 * Default/dev repository — module-level array, no database required.
 * Selected by lib/db/registry.ts whenever MongoDB isn't configured. Not
 * suitable for production: state doesn't survive a restart and isn't
 * shared across serverless instances.
 */
const store: Campaign[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryCampaignRepository: CampaignRepository = {
  async findByCode(code: string): Promise<Campaign | null> {
    const upper = code.toUpperCase();
    return scopeToTenant(store).find((c) => c.code === upper) ?? null;
  },

  async findById(id: string): Promise<Campaign | null> {
    return findOwnedByTenant(store, (c) => c.id === id) ?? null;
  },

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const code = input.code.toUpperCase();
    if (scopeToTenant(store).some((c) => c.code === code)) {
      throw new DuplicateKeyError("Campaign", { code });
    }
    const campaign: Campaign = stampTenant<Campaign>({
      ...input,
      code,
      status: input.status ?? "draft",
      registrationCount: 0,
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(campaign);
    return campaign;
  },

  async listActive(): Promise<Campaign[]> {
    return scopeToTenant(store).filter((c) => c.status === "active");
  },

  async incrementRegistrationCount(id: string): Promise<Campaign> {
    const campaign = findOwnedByTenant(store, (c) => c.id === id);
    if (!campaign) throw new Error(`Campaign ${id} not found`);
    campaign.registrationCount += 1;
    campaign.updatedAt = nowIso();
    return campaign;
  },

  async list(filters: CampaignListFilters, page: number, limit: number): Promise<PaginatedResult<Campaign>> {
    let results = scopeToTenant(store);
    if (filters.status) results = results.filter((c) => c.status === filters.status);
    if (filters.channel) results = results.filter((c) => c.channel === filters.channel);
    if (filters.search) {
      const query = filters.search.toLowerCase();
      results = results.filter(
        (c) => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query),
      );
    }
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },
};

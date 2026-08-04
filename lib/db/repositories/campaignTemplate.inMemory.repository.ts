import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CampaignTemplate,
  CampaignTemplateListFilters,
  CampaignTemplateRepository,
  CreateCampaignTemplateInput,
  UpdateCampaignTemplateApprovalInput,
} from "@/lib/services/whatsappCampaigns/types";

const store: CampaignTemplate[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryCampaignTemplateRepository: CampaignTemplateRepository = {
  async create(input: CreateCampaignTemplateInput): Promise<CampaignTemplate> {
    const template: CampaignTemplate = stampTenant<CampaignTemplate>({
      ...input,
      id: randomUUID(),
      approvalStatus: "unknown",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(template);
    return template;
  },

  async findById(id: string): Promise<CampaignTemplate | null> {
    return findOwnedByTenant(store, (t) => t.id === id) ?? null;
  },

  async list(
    filters: CampaignTemplateListFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<CampaignTemplate>> {
    let results = scopeToTenant(store);
    if (filters.search) {
      const query = filters.search.toLowerCase();
      results = results.filter(
        (t) => t.name.toLowerCase().includes(query) || t.metaTemplateName.toLowerCase().includes(query),
      );
    }
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async listAll(): Promise<CampaignTemplate[]> {
    return scopeToTenant(store);
  },

  async updateApprovalStatus(id: string, patch: UpdateCampaignTemplateApprovalInput): Promise<CampaignTemplate> {
    const template = findOwnedByTenant(store, (t) => t.id === id);
    if (!template) throw new Error(`CampaignTemplate ${id} not found`);
    template.approvalStatus = patch.approvalStatus;
    template.approvalStatusCheckedAt = patch.approvalStatusCheckedAt;
    template.updatedAt = nowIso();
    return template;
  },
};

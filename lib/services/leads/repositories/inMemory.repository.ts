import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateLeadInput,
  DuplicateLeadGroup,
  Lead,
  LeadListFilters,
  LeadRepository,
  UpdateLeadInput,
  UtmBreakdownRow,
} from "../types";

/**
 * Default/dev repository. Not a database — holds leads in a module-level
 * array for the lifetime of the running Node process. This is what the
 * app runs against whenever MONGODB_URI isn't configured (see
 * lib/db/registry.ts), so leadService is callable and testable with zero
 * database setup.
 *
 * NOT suitable for production: state does not survive a restart and is
 * not shared across serverless function instances. Set MONGODB_URI to
 * use the real, persistent repository instead.
 */
const store: Lead[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function matchesFilters(lead: Lead, filters: LeadListFilters): boolean {
  if (filters.status && lead.status !== filters.status) return false;
  if (filters.source && lead.source !== filters.source) return false;
  if (filters.program && lead.program !== filters.program) return false;
  if (filters.createdAfter && lead.createdAt < filters.createdAfter) return false;
  if (filters.createdBefore && lead.createdAt > filters.createdBefore) return false;
  if (filters.tags && filters.tags.length > 0 && !filters.tags.some((t) => lead.tags.includes(t))) return false;
  if (filters.assignedCounsellorId && lead.assignedCounsellorId !== filters.assignedCounsellorId) return false;
  if (filters.utmCampaign && lead.utm?.utmCampaign !== filters.utmCampaign) return false;
  if (filters.health && lead.health !== filters.health) return false;
  if (filters.archived !== undefined && lead.archived !== filters.archived) return false;
  if (filters.deleted === true && !lead.deletedAt) return false;
  if (filters.deleted === false && lead.deletedAt) return false;
  if (filters.search) {
    const query = filters.search.toLowerCase();
    const haystack = `${lead.name} ${lead.email} ${lead.phone} ${lead.program ?? ""}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

export const inMemoryLeadRepository: LeadRepository = {
  async findByPhoneOrEmail(phone: string, email: string): Promise<Lead | null> {
    return scopeToTenant(store).find((lead) => lead.phone === phone || lead.email === email) ?? null;
  },

  async findById(id: string): Promise<Lead | null> {
    return findOwnedByTenant(store, (lead) => lead.id === id) ?? null;
  },

  async create(input: CreateLeadInput): Promise<Lead> {
    const lead: Lead = stampTenant<Lead>({
      ...input,
      id: randomUUID(),
      status: "new",
      tags: [],
      customFields: {},
      score: 0,
      health: "cold",
      archived: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(lead);
    return lead;
  },

  async recordTouchpoint(id: string): Promise<Lead> {
    const lead = findOwnedByTenant(store, (l) => l.id === id);
    if (!lead) throw new Error(`Lead ${id} not found`);
    lead.updatedAt = nowIso();
    return lead;
  },

  async list(filters: LeadListFilters, page: number, limit: number): Promise<PaginatedResult<Lead>> {
    const results = scopeToTenant(store).filter((l) => matchesFilters(l, filters)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async utmBreakdown(): Promise<UtmBreakdownRow[]> {
    const rows = new Map<string, UtmBreakdownRow>();
    for (const lead of scopeToTenant(store)) {
      const key = `${lead.utm?.utmSource ?? ""}|${lead.utm?.utmMedium ?? ""}|${lead.utm?.utmCampaign ?? ""}`;
      const existing = rows.get(key);
      if (existing) {
        existing.leadCount += 1;
      } else {
        rows.set(key, {
          utmSource: lead.utm?.utmSource,
          utmMedium: lead.utm?.utmMedium,
          utmCampaign: lead.utm?.utmCampaign,
          leadCount: 1,
        });
      }
    }
    return Array.from(rows.values()).sort((a, b) => b.leadCount - a.leadCount);
  },

  async update(id: string, input: UpdateLeadInput): Promise<Lead> {
    const lead = findOwnedByTenant(store, (l) => l.id === id);
    if (!lead) throw new Error(`Lead ${id} not found`);
    Object.assign(lead, input, { updatedAt: nowIso() });
    return lead;
  },

  async bulkUpdate(ids: string[], input: UpdateLeadInput): Promise<string[]> {
    const matched: string[] = [];
    for (const lead of scopeToTenant(store)) {
      if (ids.includes(lead.id)) {
        Object.assign(lead, input, { updatedAt: nowIso() });
        matched.push(lead.id);
      }
    }
    return matched;
  },

  async bulkDelete(ids: string[]): Promise<string[]> {
    // RC-5 — soft-delete, mirroring the Mongo repository: recoverable
    // via bulkRestore, never spliced out of the store.
    const matched: string[] = [];
    for (const lead of scopeToTenant(store)) {
      if (ids.includes(lead.id)) {
        lead.deletedAt = nowIso();
        matched.push(lead.id);
      }
    }
    return matched;
  },

  async bulkRestore(ids: string[]): Promise<string[]> {
    const matched: string[] = [];
    for (const lead of scopeToTenant(store)) {
      if (ids.includes(lead.id)) {
        lead.deletedAt = undefined;
        matched.push(lead.id);
      }
    }
    return matched;
  },

  async listAllIds(filters: LeadListFilters): Promise<string[]> {
    return scopeToTenant(store).filter((l) => matchesFilters(l, filters)).map((l) => l.id);
  },

  async findDuplicateGroups(): Promise<DuplicateLeadGroup[]> {
    const groups: DuplicateLeadGroup[] = [];
    for (const field of ["phone", "email"] as const) {
      const byValue = new Map<string, Lead[]>();
      for (const lead of scopeToTenant(store)) {
        const value = lead[field];
        const list = byValue.get(value) ?? [];
        list.push(lead);
        byValue.set(value, list);
      }
      for (const [value, leads] of byValue) {
        if (leads.length > 1) {
          groups.push({
            matchedOn: field,
            matchedValue: value,
            leads: leads.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          });
        }
      }
    }
    return groups;
  },

  async merge(targetId: string, sourceId: string, fieldsFromSource: string[] = []): Promise<Lead> {
    const target = findOwnedByTenant(store, (l) => l.id === targetId);
    const source = findOwnedByTenant(store, (l) => l.id === sourceId);
    if (!target) throw new Error(`Lead ${targetId} not found`);
    if (!source) throw new Error(`Lead ${sourceId} not found`);

    for (const field of fieldsFromSource) {
      if (field in source) {
        (target as unknown as Record<string, unknown>)[field] = (source as unknown as Record<string, unknown>)[field];
      }
    }
    target.tags = Array.from(new Set([...target.tags, ...source.tags]));
    target.customFields = { ...source.customFields, ...target.customFields };
    target.updatedAt = nowIso();

    // RC-5 — soft-delete the losing side, mirroring the Mongo repository.
    source.deletedAt = nowIso();
    return target;
  },
};

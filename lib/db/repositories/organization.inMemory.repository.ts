import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateOrganizationInput,
  Organization,
  OrganizationListFilters,
  OrganizationRepository,
  UpdateOrganizationInput,
} from "@/lib/services/organizations/types";

/**
 * Default/dev repository — module-level array, no database required.
 * Selected by lib/db/registry.ts whenever MongoDB isn't configured. Same
 * caveat as every other in-memory repository: not suitable for
 * production (state doesn't survive a restart or a serverless cold
 * start).
 */
const store: Organization[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function matchesFilters(org: Organization, filters: OrganizationListFilters): boolean {
  if (filters.status && org.status !== filters.status) return false;
  if (filters.search) {
    const query = filters.search.toLowerCase();
    if (!org.name.toLowerCase().includes(query) && !org.slug.toLowerCase().includes(query)) return false;
  }
  return true;
}

export const inMemoryOrganizationRepository: OrganizationRepository = {
  async findById(id: string): Promise<Organization | null> {
    return store.find((o) => o.id === id) ?? null;
  },

  async findBySlug(slug: string): Promise<Organization | null> {
    const lower = slug.toLowerCase();
    return store.find((o) => o.slug === lower) ?? null;
  },

  // `session` (real Mongo transaction support) is deliberately not in
  // this signature at all — TypeScript's structural typing lets an
  // implementation accept fewer parameters than an interface's own
  // optional one declares, the same precedent
  // registration.inMemory.repository.ts's own create() already
  // established for the identical case.
  async create(input: CreateOrganizationInput): Promise<Organization> {
    const slug = input.slug.toLowerCase();
    if (store.some((o) => o.slug === slug)) {
      throw new DuplicateKeyError("Organization", { slug });
    }
    const organization: Organization = {
      ...input,
      slug,
      status: "active",
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.push(organization);
    return organization;
  },

  async list(filters: OrganizationListFilters, page: number, limit: number): Promise<PaginatedResult<Organization>> {
    const results = store.filter((o) => matchesFilters(o, filters)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async update(id: string, patch: UpdateOrganizationInput): Promise<Organization> {
    const org = store.find((o) => o.id === id);
    if (!org) throw new Error(`Organization ${id} not found`);
    const mutableOrg = org as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete mutableOrg[key];
      else if (value !== undefined) mutableOrg[key] = value;
    }
    org.updatedAt = nowIso();
    return org;
  },
};

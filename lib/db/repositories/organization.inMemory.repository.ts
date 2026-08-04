import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import type { CreateOrganizationInput, Organization, OrganizationRepository } from "@/lib/services/organizations/types";

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

export const inMemoryOrganizationRepository: OrganizationRepository = {
  async findById(id: string): Promise<Organization | null> {
    return store.find((o) => o.id === id) ?? null;
  },

  async findBySlug(slug: string): Promise<Organization | null> {
    const lower = slug.toLowerCase();
    return store.find((o) => o.slug === lower) ?? null;
  },

  async create(input: CreateOrganizationInput): Promise<Organization> {
    const slug = input.slug.toLowerCase();
    if (store.some((o) => o.slug === slug)) {
      throw new DuplicateKeyError("Organization", { slug });
    }
    const organization: Organization = {
      ...input,
      slug,
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.push(organization);
    return organization;
  },
};

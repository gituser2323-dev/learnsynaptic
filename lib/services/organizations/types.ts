/**
 * Organization domain layer — Business OS Phase 0 scaffolding.
 *
 * Deliberately minimal by design: this is the tenant-root *schema*
 * decision (every other collection can now optionally reference an
 * Organization), not the multi-tenant feature build. No plan tiers,
 * no billing, no per-org branding, no CRUD API surface, no tenant-scoped
 * querying anywhere yet — those are Phase 6 ("Multi-tenant activation")
 * per the Business OS roadmap. What exists here is exactly enough to (1)
 * have a real collection to reference and (2) guarantee exactly one
 * bootstrap Organization exists so every existing single-tenant record
 * has somewhere to (optionally) point.
 */

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  /** Throws DuplicateKeyError (lib/db/types.ts) if the slug already exists. */
  create(input: CreateOrganizationInput): Promise<Organization>;
}

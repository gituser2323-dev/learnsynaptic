import { DuplicateKeyError } from "@/lib/db/types";
import { getOrganizationRepository } from "@/lib/db/registry";
import type { Organization } from "./types";

/**
 * The single bootstrap tenant every pre-multi-tenant record can
 * (optionally) point at — see the module doc comment in types.ts. No
 * validation.ts exists yet because there is currently exactly one
 * caller (this function, with a hardcoded trusted input) and no
 * external/admin-supplied input path — that arrives with Phase 6's real
 * Organization CRUD API.
 */
const DEFAULT_ORG_SLUG = "default";
const DEFAULT_ORG_NAME = "Default Organization";

/**
 * Find-or-create, race-safe: if two callers hit this concurrently before
 * the default org exists, the slug's unique index rejects the second
 * insert as a DuplicateKeyError — caught here and resolved by re-reading
 * the row the other caller just created, rather than surfacing the race
 * as an error.
 */
export async function ensureDefaultOrganization(): Promise<Organization> {
  const repo = await getOrganizationRepository();

  const existing = await repo.findBySlug(DEFAULT_ORG_SLUG);
  if (existing) return existing;

  try {
    return await repo.create({ name: DEFAULT_ORG_NAME, slug: DEFAULT_ORG_SLUG });
  } catch (error) {
    if (error instanceof DuplicateKeyError) {
      const createdByOtherCaller = await repo.findBySlug(DEFAULT_ORG_SLUG);
      if (createdByOtherCaller) return createdByOtherCaller;
    }
    throw error;
  }
}

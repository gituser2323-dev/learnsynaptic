import { DuplicateKeyError } from "@/lib/db/types";
import { getOrganizationRepository } from "@/lib/db/registry";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import type { PaginatedResult } from "@/lib/pagination";
import type { Organization, OrganizationListFilters } from "./types";

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

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console: the
 * platform-operator-only half of this module. Every method here is
 * cross-tenant by nature (list every org, change any single org's
 * lifecycle state) — every caller MUST be `requiredPlatformRole`-gated
 * (see withApiRoute.ts's own doc comment); there is no tenant-facing
 * equivalent of any of these and there should never be one.
 */
export const platformOrganizationService = {
  /** The platform console's own organization directory — search/filter/
   *  paginate across every organization on the deployment. */
  async listOrganizations(filters: OrganizationListFilters, page: number, limit: number): Promise<PaginatedResult<Organization>> {
    const repo = await getOrganizationRepository();
    return repo.list(filters, page, limit);
  },

  async getOrganization(id: string): Promise<Organization | null> {
    const repo = await getOrganizationRepository();
    return repo.findById(id);
  },

  /** Requires a reason — the mission's own explicit "dangerous action
   *  UX" instruction ("where appropriate require a reason") applies
   *  most obviously here: suspending a paying customer's account
   *  without a recorded reason is exactly the kind of platform action
   *  that needs to be answerable later. Idempotent: suspending an
   *  already-suspended org just updates the reason/timestamp, never
   *  throws. Does NOT touch Subscription/billing state, historical
   *  data, or audit logs — see RC-6 audit's own "suspension
   *  architecture" section for what enforcement this status field
   *  actually drives (withApiRoute.ts's write-blocking gate,
   *  schedulerService.ts's job-deferral check). */
  async suspendOrganization(id: string, reason: string, context: AuditContext = {}): Promise<Organization> {
    if (!reason.trim()) throw new Error("A reason is required to suspend an organization.");
    const repo = await getOrganizationRepository();
    const updated = await repo.update(id, {
      status: "suspended",
      suspendedAt: new Date().toISOString(),
      suspendedReason: reason.trim(),
    });
    await auditLogService.record({
      action: AUDIT_ACTIONS.PLATFORM_ORG_SUSPENDED,
      entityType: "Organization",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { reason: reason.trim() },
    });
    return updated;
  },

  /** Clears the suspension fields entirely — never leaves a stale
   *  `suspendedAt`/`suspendedReason` around once reactivated (a
   *  half-cleared suspension would be confusing in the org's own
   *  history and could be misread as "still suspended" by anything
   *  checking `suspendedAt` presence instead of `status`). Idempotent:
   *  reactivating an already-active org is a safe no-op. */
  async reactivateOrganization(id: string, context: AuditContext = {}): Promise<Organization> {
    const repo = await getOrganizationRepository();
    const updated = await repo.update(id, {
      status: "active",
      suspendedAt: null,
      suspendedReason: null,
    });
    await auditLogService.record({
      action: AUDIT_ACTIONS.PLATFORM_ORG_REACTIVATED,
      entityType: "Organization",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
    });
    return updated;
  },
};

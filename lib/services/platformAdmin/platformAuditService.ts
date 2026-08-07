import { getAuditLogRepository } from "@/lib/db";
import type { AuditLogEntry } from "@/lib/db";
import type { PaginatedResult } from "@/lib/pagination";
import { runCrossTenantSweep } from "@/lib/tenancy/context";

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console: the mission's
 * own explicit "EVERY sensitive platform operation must be audited"
 * requirement, made queryable. Every `platform.*`-prefixed action
 * (org suspended/reactivated, plan changed, limit/feature overridden,
 * trial extended, job retried, super-admin granted/revoked) already
 * gets a real AuditLog write from its own service method (see
 * lib/services/auditLog/actions.ts's own RC-6 section) — this is
 * purely the read side, filtered to that action family, cross-tenant.
 *
 * Distinct from `listPlatformSecurityEvents` (category:"security" —
 * authentication/access events) — this reads category:"business"
 * (state-change events), matched on the shared `"platform."` action
 * prefix via AuditLogListFilters' own substring `search`.
 */
export async function listPlatformAuditEvents(page: number, limit: number): Promise<PaginatedResult<AuditLogEntry>> {
  return runCrossTenantSweep(async () => {
    const repository = await getAuditLogRepository();
    return repository.list({ category: "business", search: "platform." }, page, limit);
  });
}

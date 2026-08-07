import { getAuditLogRepository } from "@/lib/db";
import type { AuditLogEntry, AuditLogListFilters } from "@/lib/db";
import type { PaginatedResult } from "@/lib/pagination";
import { runCrossTenantSweep } from "@/lib/tenancy/context";

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console: cross-tenant
 * security-event visibility (repeated failed logins, account lockouts,
 * suspicious sessions, credential changes, platform-admin actions
 * themselves) — reusing RC-1/RC-2's own security audit log wholesale,
 * never a second logging pipeline, and deliberately NOT a full SIEM
 * (the mission's own explicit boundary): this is a filtered, paginated
 * read over the existing `AuditLog` collection's `category:"security"`
 * rows, nothing more.
 *
 * `AuditLog` carries `tenantScopePlugin` (unlike ScheduledJob/Organization),
 * so this MUST run inside `runCrossTenantSweep()` — without it, a
 * platform operator's own request would silently scope to only their
 * own tenant context's organization.
 */
export async function listPlatformSecurityEvents(
  filters: Omit<AuditLogListFilters, "category">,
  page: number,
  limit: number,
): Promise<PaginatedResult<AuditLogEntry>> {
  return runCrossTenantSweep(async () => {
    const repository = await getAuditLogRepository();
    return repository.list({ ...filters, category: "security" }, page, limit);
  });
}

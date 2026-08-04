import { getAuditLogRepository } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { PaginatedResult } from "@/lib/pagination";
import type { AuditEntityType, AuditLogEntry, AuditLogListFilters } from "@/lib/db";
import type { RecordAuditEventInput } from "./types";

const logger = createLogger({ service: "auditLog" });

/**
 * Application layer for Business Audit Events specifically — see
 * AUDIT_ARCHITECTURE.md for the full design and the three-way split
 * (Business / Operational / Security). This service only ever writes
 * category: "business" entries; a future securityAuditService would be
 * a separate module writing category: "security" to the same
 * repository, never this one.
 *
 * Called explicitly by leadService/campaignService/registrationService
 * after their business decision has already resolved — never
 * automatically at the repository level (§1), and never for rejected/
 * failed attempts or idempotent duplicate-touch paths (§2, approved
 * decisions).
 *
 * record() never throws: a failed audit write is logged as an
 * operational log entry (lib/logger.ts — NOT this module's own AuditLog
 * collection; a write failure isn't itself a business event) and
 * swallowed, so an audit-subsystem hiccup can never block or fail the
 * business operation that triggered it (§8/§9).
 */
export const auditLogService = {
  async record<TMetadata = Record<string, unknown>>(
    input: RecordAuditEventInput<TMetadata>,
  ): Promise<AuditLogEntry | undefined> {
    try {
      const repository = await getAuditLogRepository();
      const entry = await repository.record({
        action: input.action,
        category: "business",
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actorId,
        actorType: input.actorType,
        requestId: input.requestId,
        metadata: input.metadata as Record<string, unknown> | undefined,
      });
      // Operational visibility into the audit pipeline itself — without
      // this, "the pipeline is silently broken" and "nothing audit-worthy
      // has happened" look identical from the outside.
      logger.info("audit.recorded", {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        auditEntryId: entry.id,
      });
      return entry;
    } catch (error) {
      logger.error("audit.write_failed", {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  },

  async listForEntity(entityType: AuditEntityType, entityId: string): Promise<AuditLogEntry[]> {
    const repository = await getAuditLogRepository();
    return repository.findByEntity(entityType, entityId);
  },

  /** Admin Dashboard — Audit Logs page: filtered/paginated listing. */
  async list(
    filters: AuditLogListFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<AuditLogEntry>> {
    const repository = await getAuditLogRepository();
    return repository.list(filters, page, limit);
  },
};

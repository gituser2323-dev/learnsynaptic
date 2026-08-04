import { getAuditLogRepository } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { AuditEntityType, AuditLogEntry } from "@/lib/db";
import type { RecordAuditEventInput } from "./types";

const logger = createLogger({ service: "securityAuditLog" });

/**
 * Application layer for Security Audit Events specifically — the
 * category AUDIT_ARCHITECTURE.md's approved design planned for but had
 * no producer of until Authentication (Module 9). Kept as its own
 * module rather than a `category` parameter on auditLogService.record()
 * — see that file's own doc comment ("a future securityAuditService
 * would be a separate module ... never this one"), written before this
 * module existed.
 *
 * Same error-handling contract as auditLogService: record() never
 * throws. A failed security-audit write is logged operationally
 * (lib/logger.ts) and swallowed — a hiccup in this pipeline must never
 * block a login, logout, or refresh.
 */
export const securityAuditLogService = {
  async record<TMetadata = Record<string, unknown>>(
    input: RecordAuditEventInput<TMetadata>,
  ): Promise<AuditLogEntry | undefined> {
    try {
      const repository = await getAuditLogRepository();
      const entry = await repository.record({
        action: input.action,
        category: "security",
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actorId,
        actorType: input.actorType,
        requestId: input.requestId,
        metadata: input.metadata as Record<string, unknown> | undefined,
      });
      logger.info("security_audit.recorded", {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        auditEntryId: entry.id,
      });
      return entry;
    } catch (error) {
      logger.error("security_audit.write_failed", {
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
    const entries = await repository.findByEntity(entityType, entityId);
    return entries.filter((entry) => entry.category === "security");
  },
};

import { randomUUID } from "crypto";
import { getLeadRepository } from "@/lib/db";
import { getTenantContext } from "@/lib/tenancy/context";
import { ensureDefaultOrganization } from "@/lib/services/organizations";
import { validateCreateLeadInput } from "./validation";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { publish } from "@/lib/events";
import { activityService } from "@/lib/services/crm/activities";
import { assignmentService } from "@/lib/services/crm/assignment";
import { scoringService } from "@/lib/services/crm/scoring";
import { customFieldService, validateCustomFieldValues } from "@/lib/services/crm/customFields";
import { parseAndValidateLeadCsv } from "@/lib/services/crm/import";
import type { PaginatedResult } from "@/lib/pagination";
import type { AuditContext } from "@/lib/services/auditLog";
import type {
  CreateLeadResult,
  DuplicateLeadGroup,
  Lead,
  LeadListFilters,
  LeadValidationError,
  UpdateLeadInput,
  UtmBreakdownRow,
} from "./types";

export interface BulkOperationResult {
  matchedCount: number;
  matchedIds: string[];
}

export interface LeadImportResult {
  imported: number;
  duplicates: number;
  rejected: { rowNumber: number; raw: Record<string, string>; reason: string }[];
  truncated: boolean;
}

export type LeadImportPreview =
  | { success: true; validRowCount: number; rejected: LeadImportResult["rejected"]; truncated: boolean }
  | { success: false; error: string };

/** Shared by registerLead (creation) and updateLead (edits) — a lead's
 *  score/health can move on either path, so both recompute through this
 *  one function rather than duplicating the "read the lead back, score
 *  it, write the result" sequence. */
async function recomputeAndPersistScore(leadId: string): Promise<void> {
  const repository = await getLeadRepository();
  const lead = await repository.findById(leadId);
  if (!lead) return;
  const { score, health } = await scoringService.computeScore(lead);
  await repository.update(leadId, { score, health });
}

/** Enterprise CRM (Phase 1) — writes one AuditLog entry per affected
 *  record rather than a single summary entry keyed to a fake
 *  `bulk:${count}` id. Two things this fixes at once: (1) a bad bulk
 *  action is now reversible from the audit trail per-record, matching
 *  the approved Blueprint's own Definition of Done for this module; (2)
 *  a lead's own audit history now actually shows it was touched by a
 *  bulk action — `entityId: "bulk:N"` never appeared when looking up
 *  that lead's own trail, silently hiding the change from exactly the
 *  view someone investigating that lead would check first. `batchId`
 *  ties every per-record entry from one bulk call back together for
 *  anyone who *does* want the aggregate view. */
async function recordBulkAuditEntries(
  action: string,
  leadIds: string[],
  context: AuditContext,
  metadata: Record<string, unknown>,
): Promise<void> {
  const batchId = randomUUID();
  for (const leadId of leadIds) {
    await auditLogService.record({
      action,
      entityType: "Lead",
      entityId: leadId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { ...metadata, batchId, batchSize: leadIds.length },
    });
  }
}

/**
 * Application layer for lead registration — the module every future
 * route/form should call (re-exported from index.ts). Owns the two
 * pieces of business logic that don't belong in a repository or a route
 * handler: input validation and duplicate prevention (see
 * ARCHITECTURE.md Workflow 5.8 — a repeat submission updates the
 * existing lead instead of creating a second row).
 *
 * Enterprise CRM (Phase 1) extends this with the rest of the lead
 * lifecycle — edit, tag, bulk operate, dedupe, merge, import — all
 * still behind this one service, the same "one place a route calls"
 * shape the original module already established.
 */
export const leadService = {
  async registerLead(input: unknown, context: AuditContext = {}): Promise<CreateLeadResult> {
    const validation = validateCreateLeadInput(input);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const repository = await getLeadRepository();
    const existing = await repository.findByPhoneOrEmail(validation.data.phone, validation.data.email);

    if (existing) {
      const touched = await repository.recordTouchpoint(existing.id);
      // Deliberately NOT audited — see AUDIT_ARCHITECTURE.md §2
      // (approved): a duplicate touch is the highest-volume path in the
      // app and the lowest business value per entry.
      return { success: true, lead: touched, duplicate: true };
    }

    // Business OS Phase 8, Module 8.1 — POST /api/leads is one of this
    // app's few genuinely public, unauthenticated routes (see
    // withApiRoute.ts's own doc comment on why it deliberately
    // establishes NO tenant context for such routes): a Lead captured
    // through the public marketing site has no admin session to derive
    // an organization from at all. Resolving to the deployment's one
    // default organization here — rather than leaving organizationId
    // unset — is what keeps a publicly-captured Lead visible under the
    // admin dashboard's own now-tenant-scoped queries; leaving it unset
    // would make every new public submission silently invisible the
    // moment this module ships, a real regression, not a hypothetical
    // one. When called from an authenticated admin context instead
    // (e.g. a future manual "Add Lead" admin action), that real,
    // verified organizationId is used instead of the default.
    const organizationId = getTenantContext()?.organizationId ?? (await ensureDefaultOrganization()).id;
    const created = await repository.create({ ...validation.data, organizationId });
    await auditLogService.record({
      action: AUDIT_ACTIONS.LEAD_CREATED,
      entityType: "Lead",
      entityId: created.id,
      requestId: context.requestId,
      metadata: { source: created.source, program: created.program },
    });
    // Triggers the automation engine's lead-nurture workflow (a
    // persisted WorkflowDefinition as of Module 3.1 — see
    // lib/services/automation/triggers.ts) — and any future subscriber
    // to "lead.created" — without leadService
    // needing to know who's listening. Awaited (not fire-and-forget) for
    // the same reason every other side effect in this codebase is: in a
    // serverless environment, un-awaited work can vanish when the
    // function instance is torn down before it finishes.
    await publish("lead.created", {
      leadId: created.id,
      name: created.name,
      email: created.email,
      phone: created.phone,
      program: created.program,
      source: created.source,
    });

    // Enterprise CRM (Phase 1) — score a brand-new lead immediately
    // (never leave it at the schema default of 0/cold until some later
    // write happens to trigger a recompute) and auto-assign if a
    // round-robin rule is active. Both are best-effort: a failure here
    // must not fail lead creation itself, the same "the write already
    // succeeded" reasoning RC-1's own fire-and-forget forms document.
    await recomputeAndPersistScore(created.id);
    await assignmentService.autoAssignOnCreate(created.id).catch(() => undefined);

    const final = await repository.findById(created.id);
    return { success: true, lead: final ?? created, duplicate: false };
  },

  /** Admin Dashboard Backend — Lead Management: filtered/searched/paginated
   *  listing. Enterprise CRM (Phase 1): archived leads are excluded by
   *  default — a caller must explicitly pass `archived: true` (or
   *  `undefined` via a raw repository call) to see them. */
  async listLeads(filters: LeadListFilters, page = 1, limit = 20): Promise<PaginatedResult<Lead>> {
    const repository = await getLeadRepository();
    // `archived` must be applied AFTER the spread, via `??` — spreading
    // `filters` first and defaulting before it would look equivalent,
    // but an explicit `archived: undefined` key (the normal shape when
    // a route reads a missing query param) is still a real own property
    // after a spread, and would silently override a `{ archived: false,
    // ...filters }` default back to undefined. Caught by inspection, not
    // a test — worth the explicit comment so it isn't "simplified" back
    // to the broken form later.
    return repository.list({ ...filters, archived: filters.archived ?? false }, page, limit);
  },

  /** Admin Dashboard Backend — UTM Analytics. */
  async getUtmAnalytics(): Promise<UtmBreakdownRow[]> {
    const repository = await getLeadRepository();
    return repository.utmBreakdown();
  },

  async getLead(id: string): Promise<Lead | null> {
    const repository = await getLeadRepository();
    return repository.findById(id);
  },

  /** Enterprise CRM (Phase 1) — the one generic edit path. Validates
   *  customFields against the live definition set (never trusts a
   *  client-supplied key/value blindly) before writing anything. */
  async updateLead(
    id: string,
    input: UpdateLeadInput,
    context: AuditContext = {},
  ): Promise<{ success: true; lead: Lead } | { success: false; errors: LeadValidationError[] }> {
    if (input.customFields) {
      const definitions = await customFieldService.listDefinitions();
      const errors = validateCustomFieldValues(input.customFields, definitions);
      if (errors.length > 0) return { success: false, errors };
    }

    const repository = await getLeadRepository();
    const updated = await repository.update(id, input);
    await auditLogService.record({
      action: AUDIT_ACTIONS.LEAD_UPDATED,
      entityType: "Lead",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { fields: Object.keys(input) },
    });

    const scoringRelevantChange = input.status !== undefined;
    if (scoringRelevantChange) await recomputeAndPersistScore(id);

    const final = scoringRelevantChange ? ((await repository.findById(id)) ?? updated) : updated;

    // Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — a
    // real subscriber (a registered webhook endpoint, a connected
    // Slack workspace) may care about any lead edit, not just status
    // changes; publishing every update keeps this event honest rather
    // than only firing for the subset this module happens to score on.
    await publish("lead.updated", { leadId: id, name: final.name, email: final.email, status: final.status, fields: Object.keys(input) });

    return { success: true, lead: final };
  },

  async tagLead(id: string, tagIds: string[], context: AuditContext = {}): Promise<Lead> {
    const repository = await getLeadRepository();
    const updated = await repository.update(id, { tags: tagIds });
    await auditLogService.record({
      action: AUDIT_ACTIONS.LEAD_TAGGED,
      entityType: "Lead",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { tagIds },
    });
    await recomputeAndPersistScore(id);
    return (await repository.findById(id)) ?? updated;
  },

  /** Enterprise CRM (Phase 1) — one-time backfill for leads created
   *  before scoring existed (registerLead/updateLead/tagLead all
   *  recompute on their own write path going forward; this is only for
   *  the leads that predate all three). Deliberately not run on every
   *  deploy — see scripts/backfillLeadScores.ts, the same "out-of-band
   *  operation" precedent as createAdminUser.ts/resetAdminPassword.ts.
   *  Includes archived leads (an empty filter matches everything) so
   *  none are left permanently stuck at score 0 if unarchived later. */
  async backfillScores(): Promise<{ processed: number }> {
    const repository = await getLeadRepository();
    const ids = await repository.listAllIds({});
    for (const id of ids) {
      await recomputeAndPersistScore(id);
    }
    return { processed: ids.length };
  },

  // ─── Bulk Operations (Phase 1) ──────────────────────────────────────
  // Every bulk method resolves the target id set once (either the
  // caller's explicit ids, or every id matching a filter — "select all
  // matching") and audit-logs the action with the resolved id list in
  // its metadata, so a bad bulk action is traceable/reversible from the
  // audit trail alone (see the approved Blueprint's own note on this).

  async _resolveBulkTargets(ids: string[] | undefined, filters: LeadListFilters | undefined): Promise<string[]> {
    if (ids && ids.length > 0) return ids;
    if (filters) {
      const repository = await getLeadRepository();
      return repository.listAllIds(filters);
    }
    return [];
  },

  async bulkUpdate(
    ids: string[] | undefined,
    filters: LeadListFilters | undefined,
    input: UpdateLeadInput,
    context: AuditContext = {},
  ): Promise<BulkOperationResult> {
    const targets = await this._resolveBulkTargets(ids, filters);
    if (targets.length === 0) return { matchedCount: 0, matchedIds: [] };

    const repository = await getLeadRepository();
    const matched = await repository.bulkUpdate(targets, input);
    await recordBulkAuditEntries(AUDIT_ACTIONS.LEAD_BULK_UPDATED, matched, context, { input });
    return { matchedCount: matched.length, matchedIds: matched };
  },

  async bulkDelete(
    ids: string[] | undefined,
    filters: LeadListFilters | undefined,
    context: AuditContext = {},
  ): Promise<BulkOperationResult> {
    const targets = await this._resolveBulkTargets(ids, filters);
    if (targets.length === 0) return { matchedCount: 0, matchedIds: [] };

    const repository = await getLeadRepository();
    const matched = await repository.bulkDelete(targets);
    await recordBulkAuditEntries(AUDIT_ACTIONS.LEAD_BULK_DELETED, matched, context, {});
    return { matchedCount: matched.length, matchedIds: matched };
  },

  async bulkArchive(
    ids: string[] | undefined,
    filters: LeadListFilters | undefined,
    archived: boolean,
    context: AuditContext = {},
  ): Promise<BulkOperationResult> {
    const targets = await this._resolveBulkTargets(ids, filters);
    if (targets.length === 0) return { matchedCount: 0, matchedIds: [] };

    const repository = await getLeadRepository();
    const matched = await repository.bulkUpdate(targets, { archived });
    await recordBulkAuditEntries(AUDIT_ACTIONS.LEAD_BULK_ARCHIVED, matched, context, { archived });
    return { matchedCount: matched.length, matchedIds: matched };
  },

  async bulkAssign(
    ids: string[] | undefined,
    filters: LeadListFilters | undefined,
    counsellorId: string,
    context: AuditContext = {},
  ): Promise<BulkOperationResult> {
    const targets = await this._resolveBulkTargets(ids, filters);
    if (targets.length === 0) return { matchedCount: 0, matchedIds: [] };

    const repository = await getLeadRepository();
    const matched = await repository.bulkUpdate(targets, { assignedCounsellorId: counsellorId });
    await recordBulkAuditEntries(AUDIT_ACTIONS.LEAD_BULK_ASSIGNED, matched, context, { counsellorId });
    return { matchedCount: matched.length, matchedIds: matched };
  },

  async bulkTag(
    ids: string[] | undefined,
    filters: LeadListFilters | undefined,
    tagId: string,
    context: AuditContext = {},
  ): Promise<BulkOperationResult> {
    const targets = await this._resolveBulkTargets(ids, filters);
    if (targets.length === 0) return { matchedCount: 0, matchedIds: [] };

    // Additive per-lead (a lead's existing tags are kept, tagId is added
    // if missing) — a flat bulkUpdate({ tags: [tagId] }) would instead
    // overwrite every other tag on every matched lead, which "bulk tag"
    // should never do.
    const repository = await getLeadRepository();
    const changed: string[] = [];
    for (const id of targets) {
      const lead = await repository.findById(id);
      if (lead && !lead.tags.includes(tagId)) {
        await repository.update(id, { tags: [...lead.tags, tagId] });
        changed.push(id);
      }
    }
    // Only the leads that actually gained the tag get an audit entry —
    // a lead that already had it wasn't touched, so it shouldn't show up
    // in that lead's own audit trail as if something changed.
    await recordBulkAuditEntries(AUDIT_ACTIONS.LEAD_BULK_TAGGED, changed, context, { tagId });
    return { matchedCount: targets.length, matchedIds: targets };
  },

  // ─── Duplicate Detection & Merge (Phase 1) ──────────────────────────

  async findDuplicates(): Promise<DuplicateLeadGroup[]> {
    const repository = await getLeadRepository();
    return repository.findDuplicateGroups();
  },

  async mergeLeads(
    targetId: string,
    sourceId: string,
    fieldsFromSource: string[] = [],
    context: AuditContext = {},
  ): Promise<Lead> {
    const repository = await getLeadRepository();
    const merged = await repository.merge(targetId, sourceId, fieldsFromSource);
    await auditLogService.record({
      action: AUDIT_ACTIONS.LEAD_MERGED,
      entityType: "Lead",
      entityId: targetId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { sourceId, fieldsFromSource },
    });
    await activityService.logSystemEvent("Lead", targetId, `Merged with a duplicate lead`);
    return merged;
  },

  // ─── Import (Phase 1) ────────────────────────────────────────────────

  /** Dry-run — parses and validates without writing anything. The
   *  "Preview Before Import" requirement: a caller shows this to the
   *  user, and only calls importLeadsFromCsv() (below) once they confirm. */
  previewImport(csvText: string): LeadImportPreview {
    const result = parseAndValidateLeadCsv(csvText);
    if (result.fileError) return { success: false, error: result.fileError };
    return { success: true, validRowCount: result.rows.length, rejected: result.rejected, truncated: result.truncated };
  },

  /** Commit path — reuses registerLead() per row so import goes through
   *  the exact same validation/dedup/scoring/assignment logic a single
   *  form submission does, never a parallel "fast path" that could
   *  silently diverge from it. */
  async importLeadsFromCsv(csvText: string, context: AuditContext = {}): Promise<LeadImportResult> {
    const parsed = parseAndValidateLeadCsv(csvText);
    if (parsed.fileError) {
      return { imported: 0, duplicates: 0, rejected: [], truncated: false };
    }

    let imported = 0;
    let duplicates = 0;

    for (const row of parsed.rows) {
      const result = await this.registerLead({ ...row, source: "csv-import" }, context);
      if (result.success) {
        if (result.duplicate) duplicates += 1;
        else imported += 1;
      }
    }

    await auditLogService.record({
      action: AUDIT_ACTIONS.LEAD_IMPORTED,
      entityType: "Lead",
      entityId: `import:${imported}`,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { imported, duplicates, rejectedCount: parsed.rejected.length },
    });

    return { imported, duplicates, rejected: parsed.rejected, truncated: parsed.truncated };
  },
};

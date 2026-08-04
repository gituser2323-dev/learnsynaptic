import type { ClientSession } from "mongoose";
import type { PaginatedResult } from "@/lib/pagination";

/**
 * Lead domain layer.
 *
 * LeadRepository is the dependency-inversion boundary for this module:
 * leadService.ts depends only on this interface, never on Mongoose or a
 * specific store. See lib/db/registry.ts for how a concrete repository
 * gets selected — this module's in-memory default lives alongside it
 * (repositories/inMemory.repository.ts); the MongoDB implementation now
 * lives in lib/db/repositories/lead.mongodb.repository.ts, consolidated
 * with Campaign/Registration/AuditLog's persistence on the same shared
 * connection (see lib/db/connection.ts).
 */

export type LeadStatus = "new" | "contacted" | "nurture" | "registered" | "closed";

export interface LeadUtmParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

/**
 * Generic enough to back any lead-capture surface (register page,
 * contact form, a funnel modal) — the specific surface is recorded in
 * `source`, not baked into a separate type per form.
 */
export interface CreateLeadInput {
  name: string;
  email: string;
  /** Normalized to +91XXXXXXXXXX by validation.ts before this type is constructed. */
  phone: string;
  program?: string;
  /** Free-form origin tag, e.g. "register-page", "contact-form", "ai-bootcamp-funnel". */
  source: string;
  message?: string;
  utm?: LeadUtmParams;
  /** Business OS Phase 8, Module 8.1 — set by leadService.registerLead()
   *  itself (real tenant context if authenticated, else the deployment's
   *  default organization for public capture — see that method's own
   *  doc comment), never accepted directly from request input. Optional
   *  here only so pre-8.1 call sites/tests keep compiling. */
  organizationId?: string;
}

export interface Lead extends CreateLeadInput {
  id: string;
  status: LeadStatus;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  /** Enterprise CRM (Phase 1) — Tag ids, not labels (see
   *  lib/services/crm/tags). Denormalized array on the owning record,
   *  same shape as `utm`. */
  tags: string[];
  /** Enterprise CRM (Phase 1) — keyed by CustomFieldDefinition.key,
   *  validated against the live definition set on every write (see
   *  lib/services/crm/customFields/validation.ts). */
  customFields: Record<string, unknown>;
  /** Enterprise CRM (Phase 1) — 0–100, recomputed by scoringService on
   *  every write that could move it (status/tag/activity changes). */
  score: number;
  health: "hot" | "warm" | "cold";
  /** Enterprise CRM (Phase 1) — a User id (counsellor/manager/admin
   *  role). See lib/services/crm/assignment. */
  assignedCounsellorId?: string;
  /** Enterprise CRM (Phase 1) — soft-delete flag for bulk archive; an
   *  archived lead is excluded from the default list view but never
   *  hard-deleted (bulk delete is a separate, explicit action). */
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadValidationError {
  field: string;
  message: string;
}

export type CreateLeadResult =
  | { success: true; lead: Lead; duplicate: boolean }
  | { success: false; errors: LeadValidationError[] };

/** Admin Dashboard Backend — Lead Management filters. Enterprise CRM
 *  (Phase 1) added tags/counsellor/health/archived — every other field
 *  predates this phase, unchanged. */
export interface LeadListFilters {
  status?: LeadStatus;
  source?: string;
  program?: string;
  /** Case-insensitive match against name, email, phone, or program —
   *  widened in Phase 1 (Enterprise Search); previously name/email/phone only. */
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  /** Match any lead carrying at least one of these tag ids. */
  tags?: string[];
  assignedCounsellorId?: string;
  health?: Lead["health"];
  /** Defaults to false (archived leads excluded) at the service layer —
   *  not defaulted here, so a repository implementation can't guess wrong. */
  archived?: boolean;
  /** Enterprise Analytics (Phase 7), module 7.2 — Campaign ROI's own
   *  "leads for this Campaign" lookup, matched against
   *  Lead.utm.utmCampaign (a string match, since Lead carries no direct
   *  campaignId — see CampaignRoiEntry.leadMatchAvailable's own doc). */
  utmCampaign?: string;
}

export interface UtmBreakdownRow {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  leadCount: number;
}

/** Enterprise CRM (Phase 1) — the mutable subset of Lead every write
 *  path (single edit, bulk update, dedup merge) goes through. Deliberately
 *  excludes id/createdAt/organizationId — identity and tenancy are never
 *  reassigned by an update. */
export interface UpdateLeadInput {
  name?: string;
  email?: string;
  phone?: string;
  program?: string;
  message?: string;
  status?: LeadStatus;
  tags?: string[];
  customFields?: Record<string, unknown>;
  score?: number;
  health?: Lead["health"];
  assignedCounsellorId?: string;
  archived?: boolean;
}

/** Enterprise CRM (Phase 1) — Duplicate Detection review queue. Every
 *  group shares the same phone or email; `leads` is oldest-first so the
 *  UI can suggest a sensible merge target (the earliest record) by default. */
export interface DuplicateLeadGroup {
  matchedOn: "phone" | "email";
  matchedValue: string;
  leads: Lead[];
}

export interface LeadRepository {
  /** Used for duplicate prevention — see leadService.registerLead(). */
  findByPhoneOrEmail(phone: string, email: string, session?: ClientSession): Promise<Lead | null>;
  /** Used by registrationService to confirm a client-supplied leadId
   *  refers to a real lead before creating a Registration against it. */
  findById(id: string, session?: ClientSession): Promise<Lead | null>;
  create(input: CreateLeadInput, session?: ClientSession): Promise<Lead>;
  /** Called instead of create() when a duplicate is found — bumps
   *  updatedAt so "we saw this lead again" is recorded without a second row. */
  recordTouchpoint(id: string, session?: ClientSession): Promise<Lead>;
  /** Admin Dashboard Backend: filtered/searched/paginated listing. */
  list(filters: LeadListFilters, page: number, limit: number): Promise<PaginatedResult<Lead>>;
  /** Admin Dashboard Backend: UTM Analytics — lead counts grouped by
   *  (utmSource, utmMedium, utmCampaign). */
  utmBreakdown(): Promise<UtmBreakdownRow[]>;
  /** Enterprise CRM (Phase 1) — the one generic update path every
   *  Phase 1 write (edit, tag, assign, score recompute, archive) uses;
   *  throws if `id` doesn't resolve to a real lead. */
  update(id: string, input: UpdateLeadInput): Promise<Lead>;
  /** Enterprise CRM (Phase 1) — Bulk Operations. Returns the ids
   *  actually matched/updated, since a caller may request ids that don't
   *  exist or already satisfy the update. */
  bulkUpdate(ids: string[], input: UpdateLeadInput): Promise<string[]>;
  bulkDelete(ids: string[]): Promise<string[]>;
  /** Enterprise CRM (Phase 1) — every id in the collection, for a
   *  filter-scoped "select all matching" bulk action. */
  listAllIds(filters: LeadListFilters): Promise<string[]>;
  /** Enterprise CRM (Phase 1) — Duplicate Detection: groups every lead
   *  sharing a phone or email with at least one other lead. */
  findDuplicateGroups(): Promise<DuplicateLeadGroup[]>;
  /** Enterprise CRM (Phase 1) — Lead Merge: folds `sourceId` into
   *  `targetId` (target's field values win on conflict unless
   *  `fieldsFromSource` names one to take from source instead), then
   *  deletes the source row. Throws if either id doesn't resolve. */
  merge(targetId: string, sourceId: string, fieldsFromSource?: string[]): Promise<Lead>;
}

import type { ClientSession } from "mongoose";
import type { PaginatedResult } from "@/lib/pagination";

/**
 * Domain types + repository interfaces (ports) for Campaign, Registration,
 * and AuditLog. Lead's equivalents already live in
 * lib/services/leads/types.ts — kept there rather than duplicated here,
 * since Lead already has its own service module. These three don't yet;
 * when one is built (e.g. lib/services/campaigns/), its service imports
 * the repository interface from here, the same way leadService.ts
 * imports LeadRepository from its own types.ts today.
 *
 * Every mongo repository write method takes an optional `session`
 * parameter so it can be composed into lib/db/transaction.ts's
 * runInTransaction() by a future caller, without forcing every
 * single-document write through a transaction.
 */

// ─── Campaign ────────────────────────────────────────────────────────────

export type CampaignChannel = "meta" | "google" | "organic" | "referral" | "email" | "other";
export type CampaignStatus = "draft" | "active" | "paused" | "ended";

export interface Campaign {
  id: string;
  name: string;
  code: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  startDate: string;
  endDate?: string;
  budgetInr?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  notes?: string;
  /** The ad platform's own campaign id (e.g. a Meta Ads campaign id) —
   *  distinct from `utmCampaign` (a free-text UTM string used to attribute
   *  inbound Leads). Ad platforms' reporting APIs are queried by their own
   *  campaign id, not by a UTM string, so lib/services/marketing keys spend
   *  lookups off this field. Optional: only set for campaigns actually
   *  running paid ads. */
  externalAdCampaignId?: string;
  /** Server-managed — never set directly via CreateCampaignInput. Bumped
   *  atomically by registrationService.createRegistration() when a
   *  Registration references this campaign (see incrementRegistrationCount). */
  registrationCount: number;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  name: string;
  code: string;
  channel: CampaignChannel;
  status?: CampaignStatus;
  startDate: string;
  endDate?: string;
  budgetInr?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  notes?: string;
  externalAdCampaignId?: string;
}

/** Admin Dashboard Backend — Campaign Tracking filters. */
export interface CampaignListFilters {
  status?: CampaignStatus;
  channel?: CampaignChannel;
  search?: string;
}

export interface CampaignRepository {
  findByCode(code: string): Promise<Campaign | null>;
  findById(id: string): Promise<Campaign | null>;
  /** Throws DuplicateKeyError (lib/db/types.ts) if `code` already exists. */
  create(input: CreateCampaignInput, session?: ClientSession): Promise<Campaign>;
  listActive(): Promise<Campaign[]>;
  /** Atomically increments registrationCount by 1. Used inside
   *  runInTransaction() alongside a Registration create — see
   *  lib/services/registrations/registrationService.ts. */
  incrementRegistrationCount(id: string, session?: ClientSession): Promise<Campaign>;
  /** Admin Dashboard Backend: all campaigns (not just active), filtered/
   *  searched/paginated. */
  list(filters: CampaignListFilters, page: number, limit: number): Promise<PaginatedResult<Campaign>>;
}

// ─── Registration ────────────────────────────────────────────────────────

export type RegistrationStatus = "pending" | "confirmed" | "cancelled";

export interface Registration {
  id: string;
  leadId: string;
  programSlug: string;
  programName?: string;
  cohortLabel?: string;
  status: RegistrationStatus;
  source: string;
  campaignId?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegistrationInput {
  leadId: string;
  programSlug: string;
  programName?: string;
  cohortLabel?: string;
  source: string;
  campaignId?: string;
  /** Business OS Phase 8, Module 8.1 — set by registrationService
   *  itself (real tenant context if authenticated, else the
   *  deployment's default organization for public capture — the same
   *  posture leadService.registerLead() uses), never accepted directly
   *  from request input. */
  organizationId?: string;
}

/** Admin Dashboard Backend — Registration Analytics filters. */
export interface RegistrationListFilters {
  status?: RegistrationStatus;
  programSlug?: string;
  campaignId?: string;
  /** Enterprise Analytics (Phase 7), module 7.2 — inclusive ISO bounds
   *  against createdAt. */
  createdAfter?: string;
  createdBefore?: string;
}

export interface RegistrationAnalytics {
  totalRegistrations: number;
  byStatus: Record<RegistrationStatus, number>;
  byProgram: { programSlug: string; count: number }[];
}

export interface RegistrationRepository {
  findByLeadAndProgram(leadId: string, programSlug: string): Promise<Registration | null>;
  /** Used by attendanceService to confirm a client-supplied
   *  registrationId is real before recording attendance against it. */
  findById(id: string): Promise<Registration | null>;
  /** Every registration for a lead, across all programs — used by the
   *  automation engine to check "has this lead converted to anything
   *  yet" without needing to know which specific program in advance. */
  findByLead(leadId: string): Promise<Registration[]>;
  /** Throws DuplicateKeyError if this lead already has a registration for this program. */
  create(input: CreateRegistrationInput, session?: ClientSession): Promise<Registration>;
  updateStatus(id: string, status: RegistrationStatus, session?: ClientSession): Promise<Registration>;
  /** Admin Dashboard Backend: filtered/paginated listing. */
  list(filters: RegistrationListFilters, page: number, limit: number): Promise<PaginatedResult<Registration>>;
  /** Admin Dashboard Backend — Registration Analytics: counts by status
   *  and by program, computed together since both are cheap single
   *  full-collection scans at this data volume. */
  analytics(): Promise<RegistrationAnalytics>;
}

// ─── AuditLog ────────────────────────────────────────────────────────────
// See AUDIT_ARCHITECTURE.md for the full design and the three-way split
// this supports: Business Audit Events (category: "business", the only
// producer today — lib/services/auditLog), Future Security Audit Events
// (category: "security", no producer yet — deferred until
// authentication/authorization exist), and System/Operational Logs
// (a completely separate, ephemeral mechanism — lib/logger.ts /
// lib/api/logger.ts — never stored in this collection).

export type AuditEntityType =
  | "Lead"
  | "Campaign"
  | "Registration"
  | "User"
  | "WhatsAppCampaign"
  // Enterprise CRM (Phase 1)
  | "Activity"
  | "Task"
  | "Tag"
  | "CustomFieldDefinition"
  | "Opportunity"
  | "Pipeline"
  // WhatsApp Platform (Phase 2)
  | "Conversation"
  // Automation Platform (Phase 3)
  | "WorkflowDefinition"
  | "AutoReplyRule"
  // Integrations Hub (Phase 6)
  | "Integration"
  // File Storage (Phase 6), Module 6.2
  | "File"
  // Calendar & Meeting Connectors (Phase 6), Module 6.3
  | "Meeting"
  // Generic Webhooks & Team Notifications (Phase 6), Module 6.5
  | "WebhookEndpoint"
  // Payments Integration (Phase 6), Module 6.4
  | "Payment"
  // Billing, Plans & Feature Flags (Phase 8), Module 8.3
  | "Plan"
  | "Subscription"
  | "FeatureFlag"
  // White Label & Branding (Phase 8), Module 8.4
  | "BrandConfiguration";

export type AuditCategory = "business" | "security";

export type AuditActorType = "system" | "user" | "api";

export interface AuditLogEntry {
  id: string;
  action: string;
  category: AuditCategory;
  entityType: AuditEntityType;
  entityId: string;
  /** No Users/Auth model exists yet — system-triggered actions have no actor. */
  actorId?: string;
  actorType: AuditActorType;
  /** Correlates to lib/api/logger.ts's per-request requestId, when the
   *  triggering call came through an API route. */
  requestId?: string;
  metadata?: Record<string, unknown>;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
}

export interface CreateAuditLogInput {
  action: string;
  category: AuditCategory;
  entityType: AuditEntityType;
  entityId: string;
  actorId?: string;
  /** Defaults to "system" in the repository if omitted — same pattern as
   *  Campaign's `status` defaulting to "draft". */
  actorType?: AuditActorType;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/** Admin Dashboard — Audit Logs page filters. */
export interface AuditLogListFilters {
  category?: AuditCategory;
  entityType?: AuditEntityType;
  action?: string;
  search?: string;
}

export interface AuditLogRepository {
  record(input: CreateAuditLogInput, session?: ClientSession): Promise<AuditLogEntry>;
  findByEntity(entityType: AuditEntityType, entityId: string): Promise<AuditLogEntry[]>;
  /** Used by retention pruning (lib/services/auditLog/retention.ts). */
  findOlderThan(cutoff: Date): Promise<AuditLogEntry[]>;
  deleteByIds(ids: string[]): Promise<number>;
  /** Admin Dashboard — Audit Logs page: filtered/paginated listing. */
  list(filters: AuditLogListFilters, page: number, limit: number): Promise<PaginatedResult<AuditLogEntry>>;
}

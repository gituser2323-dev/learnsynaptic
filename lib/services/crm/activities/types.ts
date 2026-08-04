import type { PaginatedResult } from "@/lib/pagination";

/**
 * Activity domain layer — Enterprise CRM (Phase 1), Lead Timeline.
 *
 * Polymorphic by entityType/entityId, the same shape AuditLog already
 * proves out — one collection for notes/calls/meetings/emails/system
 * events across Lead and (once 1.5 ships) Opportunity, instead of a
 * table per activity type. Distinct from AuditLog: AuditLog is a
 * tamper-evident record of *system state changes* for compliance;
 * Activity is the CRM's own *business* timeline a counsellor reads and
 * writes by hand — different audience, different write frequency,
 * different reason to exist. WhatsApp message history is referenced
 * here (type: "whatsapp_reference") by id only — the Message record
 * itself stays owned by the WhatsApp Campaign Manager (out of scope for
 * this phase), this is just a pointer into it for the unified timeline.
 */

export type ActivityEntityType = "Lead" | "Opportunity" | "Conversation";

export type ActivityType =
  | "note"
  | "call"
  | "meeting"
  | "email"
  | "whatsapp_reference"
  | "system";

export interface Activity {
  id: string;
  entityType: ActivityEntityType;
  entityId: string;
  type: ActivityType;
  /** Freeform body for note/call/meeting/email; a short machine-generated
   *  summary for "system" entries (e.g. "Status changed to contacted"). */
  body: string;
  /** Set for type: "call"/"meeting" — minutes, optional. */
  durationMinutes?: number;
  /** Set for type: "whatsapp_reference" — the referenced Message's id,
   *  a pointer only (see module doc comment above). */
  referenceMessageId?: string;
  /** Absent for system-generated entries. */
  actorId?: string;
  organizationId?: string;
  createdAt: string;
}

export interface CreateActivityInput {
  entityType: ActivityEntityType;
  entityId: string;
  type: ActivityType;
  body: string;
  durationMinutes?: number;
  referenceMessageId?: string;
  actorId?: string;
  organizationId?: string;
}

export interface ActivityListFilters {
  entityType: ActivityEntityType;
  entityId: string;
}

export interface ActivityRepository {
  create(input: CreateActivityInput): Promise<Activity>;
  /** Reverse-chronological — the Timeline's own read pattern. */
  listForEntity(filters: ActivityListFilters, page: number, limit: number): Promise<PaginatedResult<Activity>>;
}

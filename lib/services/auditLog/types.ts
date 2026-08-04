import type { AuditActorType, AuditCategory, AuditEntityType, AuditLogEntry } from "@/lib/db";

/**
 * Audit-log application layer. Domain types live in
 * lib/db/repositories/types.ts (AuditLog predates this service module,
 * same reason Campaign/Registration's types live there) — imported here
 * rather than redefined.
 */

export interface RecordAuditEventInput<TMetadata = Record<string, unknown>> {
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  actorId?: string;
  actorType?: AuditActorType;
  requestId?: string;
  metadata?: TMetadata;
}

/**
 * Threaded from the API layer's per-request context (ApiRouteContext)
 * down into a business service's public method — the only piece of
 * "HTTP-ness" that crosses that boundary, and only as opaque ids.
 * `actorId` added for the WhatsApp Campaign Manager: unlike
 * Lead/Campaign/Registration creation (public, unauthenticated routes
 * when they were built), every campaign-manager route is
 * `requiredRole: "admin"` — the acting user is always known, so their
 * business actions can record who performed them.
 */
export interface AuditContext {
  requestId?: string;
  actorId?: string;
  /** RC-1 — Production Hardening: Authentication & Identity. Both
   *  optional and unused by every pre-existing caller — added here
   *  (rather than a parallel, auth-specific context type) so
   *  authService's own login/session methods can carry real IP/device
   *  metadata through the same AuditContext every other service already
   *  threads through, without inventing a second parameter shape. Login
   *  History (securityAuditLogService) is the one real consumer today. */
  ipAddress?: string;
  userAgent?: string;
}

export type { AuditActorType, AuditCategory, AuditEntityType, AuditLogEntry };

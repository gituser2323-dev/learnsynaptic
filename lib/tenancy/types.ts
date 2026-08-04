import type { UserRole } from "@/lib/services/auth/types";

/**
 * Business OS Phase 8, Module 8.1 — Tenant Data Isolation.
 *
 * The one thing every tenant-scoping mechanism in this codebase reads
 * from (the Mongoose plugin, the in-memory repository helpers, the
 * cross-entity reference validators) — never derived independently in
 * more than one place. `organizationId` is always a real, resolved
 * value here, never a client-supplied one: see context.ts's own module
 * doc for exactly where this gets populated and why that's safe to
 * trust.
 */
export interface TenantContext {
  organizationId: string;
  userId?: string;
  role?: UserRole;
}

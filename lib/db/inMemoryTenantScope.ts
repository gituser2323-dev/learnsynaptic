import { getTenantContext } from "@/lib/tenancy/context";

/**
 * Business OS Phase 8, Module 8.1 — the in-memory-repository equivalent
 * of tenantScopePlugin.ts's own Mongoose hooks. The in-memory store
 * (lib/db/registry.ts's default whenever `MONGODB_URI` isn't
 * configured — also what this app's ENTIRE unit and Playwright suite
 * runs against, per playwright.config.ts's own `MONGODB_URI: ""`) has
 * no ORM to hook into, so each tenant-owned in-memory repository calls
 * these three functions directly at the same points the Mongoose
 * plugin intercepts automatically: `scopeToTenant` wherever a query
 * would read the module-level array, `assertOwnedByTenant` before a
 * by-id write, `stampTenant` at create time. Same fail-open-with-no-
 * context behavior as the Mongoose plugin (see that file's own module
 * doc for why) — these are two implementations of one contract, not
 * two different security postures.
 */

interface TenantOwned {
  organizationId?: string;
}

/** Read paths (list/find/count/aggregate-equivalent). Returns `items`
 *  unchanged when no tenant context is active. */
export function scopeToTenant<T extends TenantOwned>(items: T[]): T[] {
  const ctx = getTenantContext();
  if (!ctx) return items;
  return items.filter((item) => item.organizationId === ctx.organizationId);
}

/** By-id read/update/delete paths. Returns the item only if it belongs
 *  to the active tenant (or if no tenant context is active) — `null`
 *  otherwise, the same "behaves like not-found, never a distinguishing
 *  403" contract tenantScopePlugin.ts's own module doc describes. */
export function findOwnedByTenant<T extends TenantOwned>(items: T[], predicate: (item: T) => boolean): T | undefined {
  const found = items.find(predicate);
  if (!found) return undefined;
  const ctx = getTenantContext();
  if (!ctx) return found;
  return found.organizationId === ctx.organizationId ? found : undefined;
}

/** Create paths. Overwrites whatever `organizationId` the input already
 *  carried — the mission's own "do NOT accept organization ownership
 *  from untrusted client input" — with the trusted context value.
 *  Returns the input unchanged when no tenant context is active. */
export function stampTenant<T extends TenantOwned>(input: T): T {
  const ctx = getTenantContext();
  if (!ctx) return input;
  return { ...input, organizationId: ctx.organizationId };
}

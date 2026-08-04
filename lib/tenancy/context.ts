import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantContext } from "./types";

export type { TenantContext };

/**
 * Business OS Phase 8, Module 8.1 — the single authoritative tenant
 * context mechanism the mission's own "TENANT CONTEXT" section asks
 * for.
 *
 * Node's `AsyncLocalStorage` (not a request-scoped variable passed
 * explicitly through every function call) so that the two real
 * call-graph shapes this app has — an HTTP request, and a background
 * job/workflow-run tick with no request at all — can both establish a
 * context the exact same way, and so that `lib/db`'s Mongoose plugin
 * (tenantScopePlugin.ts) and the in-memory repositories'
 * `inMemoryTenantScope.ts` helpers can read the *current* organization
 * without every one of the ~35 entities' repository methods needing an
 * explicit `organizationId` parameter threaded through every service
 * and route that calls them — the mission's own "prefer architecture
 * that makes unsafe unscoped access difficult" instruction, not
 * developer discipline at 300+ call sites.
 *
 * There are exactly two places this module's `runWithTenantContext` is
 * ever called from:
 *   1. `lib/api/withApiRoute.ts` — unconditionally, for every
 *      authenticated request, immediately after `getAuthContext()`
 *      resolves the trusted `x-auth-org-id` header (itself only ever
 *      set by middleware.ts from a verified JWT claim — see
 *      lib/services/auth/tokens.ts).
 *   2. The scheduler/automation-engine job-processing loops
 *      (lib/services/scheduler/schedulerService.ts,
 *      lib/services/automation/engine.ts) — once per job/run, using
 *      that specific job's own resolved organizationId, never a
 *      request's.
 *
 * Everywhere else (scripts, seed/migration code, the unit test suite's
 * own direct repository calls) runs with NO context — see
 * getTenantContext()'s own doc for what that means for the scoping
 * layers that read it. This is a deliberate, disclosed trade-off, not
 * an oversight: those callers are trusted, developer-run, one-off, or
 * (for migration scripts) explicitly cross-tenant by their own nature —
 * never an attacker-reachable path the way every route `withApiRoute`
 * wraps is.
 */
const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(context: TenantContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * The escape hatch every cross-tenant background *sweep* needs (as
 * opposed to a per-job/per-run's own real, single-organization
 * processing — that always uses runWithTenantContext above). Node's
 * `AsyncLocalStorage.exit()` runs `fn` as if no `run()` were ever
 * entered — `getTenantContext()` returns undefined inside it,
 * regardless of what context the *caller* happens to be running under.
 *
 * Why this exists at all: `runDueScheduledJobs()`/`runDueWorkflowSteps()`
 * (the scheduler/automation-engine tick) are reachable two ways — a
 * real cron trigger (no request context, this would be a no-op) and
 * `POST /api/admin/scheduler/run-due-jobs`, a real admin-authenticated
 * route (see that route's own doc comment) that DOES establish a
 * tenant context via withApiRoute. Without this escape hatch, an admin
 * clicking "Run Due Jobs Now" would silently scope the sweep to their
 * own organization's jobs only, leaving every other tenant's due work
 * unprocessed with no error — exactly the "no worker may accidentally
 * process another tenant's data because tenant context existed only in
 * an HTTP request" failure mode the mission's own BACKGROUND
 * PROCESSING section warns about, just inverted (silently *under*-
 * processing other tenants rather than leaking into them). The sweep
 * itself must see every organization; each individual job/run found by
 * it then gets its own explicit runWithTenantContext() for the part
 * that actually touches tenant-owned data — see schedulerService.ts's
 * and engine.ts's own call sites.
 */
export function runCrossTenantSweep<T>(fn: () => T): T {
  return storage.exit(fn);
}

/** Undefined outside any established context (see this module's own
 *  doc) — every reader (tenantScopePlugin.ts, inMemoryTenantScope.ts)
 *  must treat that as "no scoping available here," not crash the
 *  calling script/test. */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/** Thrown only by callers that have decided a missing context is a bug
 *  in *their own* code path (e.g. a route handler reaching a
 *  tenant-owned write with no resolved organization) — never thrown by
 *  the scoping layers themselves, which fail open for untagged callers
 *  by design (see module doc). */
export class MissingTenantContextError extends Error {
  constructor() {
    super("No tenant context is active — this code path must run inside runWithTenantContext().");
    this.name = "MissingTenantContextError";
  }
}

export function requireOrganizationId(): string {
  const ctx = getTenantContext();
  if (!ctx) throw new MissingTenantContextError();
  return ctx.organizationId;
}

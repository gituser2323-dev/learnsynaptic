import type { Aggregate, Query, Schema } from "mongoose";
import { getTenantContext } from "@/lib/tenancy/context";

/**
 * Business OS Phase 8, Module 8.1 — the real enforcement mechanism
 * behind "prefer architecture that makes unsafe unscoped access
 * difficult" (mission's own words). Applied once per tenant-owned
 * schema (`schema.plugin(tenantScopePlugin)`, see each `*.model.ts`'s
 * own one-line registration) rather than globally — which collections
 * get it is an explicit, auditable decision per model file, not an
 * exclusion list buried in this one file. See MODULE_8_1_NOTES.md /
 * the CHANGELOG entry for the full classification (tenant-owned vs.
 * tenant-root/system) and why User, RefreshToken, Organization, and
 * ScheduledJob are deliberately NOT plugged in here.
 *
 * Every query this plugin intercepts gets `organizationId` merged into
 * its filter automatically whenever a tenant context is active (see
 * lib/tenancy/context.ts) — a query for another org's document simply
 * matches nothing, which every existing service already treats
 * identically to "id doesn't exist" (a 404, never a distinguishing
 * 403) — the mission's own "cross-tenant IDs should behave safely
 * according to the existing API conventions" requirement, satisfied by
 * construction rather than a second code path.
 *
 * With NO context active (see context.ts's own doc — scripts, seeds,
 * the migration/backfill script itself, direct repository calls in
 * code that predates this module), every hook below is a no-op and
 * behavior is byte-identical to before this module existed. This is a
 * deliberate, disclosed trade-off: real protection for every
 * request/job this app actually serves traffic through, not a
 * database-level guarantee independent of the application ever calling
 * runWithTenantContext() correctly. The cross-tenant security test
 * suite (tenantIsolation.spec.ts) is what proves the request/job paths
 * this matters for are always wrapped, not this file in isolation.
 */

const SCOPED_QUERY_HOOKS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "countDocuments",
  "distinct",
] as const;

function applyTenantFilter(this: Query<unknown, unknown>): void {
  const ctx = getTenantContext();
  if (!ctx) return;
  // A caller that explicitly opts out (see e.g. authService resolving
  // a user's own organization membership by user id, which must not
  // additionally self-filter by the org it's trying to discover) sets
  // this query option deliberately — never a default, never settable
  // from any client-facing filter object.
  if (this.getOptions().skipTenantScope) return;
  this.where({ organizationId: ctx.organizationId });
}

function applyTenantFilterToAggregate(this: Aggregate<unknown[]>): void {
  const ctx = getTenantContext();
  if (!ctx) return;
  const options = this.options as { skipTenantScope?: boolean } | undefined;
  if (options?.skipTenantScope) return;
  this.pipeline().unshift({ $match: { organizationId: ctx.organizationId } });
}

export function tenantScopePlugin(schema: Schema): void {
  for (const hook of SCOPED_QUERY_HOOKS) {
    schema.pre(hook, applyTenantFilter);
  }
  schema.pre("aggregate", applyTenantFilterToAggregate);

  // Create paths. `Model.create()` and a manually-constructed
  // `new Model(...).save()` both fire 'save' document middleware;
  // `Model.insertMany()` fires its own separate hook. Overwrites
  // whatever organizationId a caller supplied — the mission's own
  // "do NOT accept organization ownership from untrusted client input"
  // requirement — trusted server context always wins over anything
  // already on the document, never merely fills a gap.
  schema.pre("save", function tenantStampOnSave(this: { organizationId?: unknown; isNew: boolean }) {
    const ctx = getTenantContext();
    if (!ctx) return;
    if (this.isNew) this.organizationId = ctx.organizationId;
  });

  schema.pre("insertMany", function tenantStampOnInsertMany(docs: unknown) {
    const ctx = getTenantContext();
    if (!ctx) return;
    const list = (Array.isArray(docs) ? docs : [docs]) as Array<{ organizationId?: unknown }>;
    for (const doc of list) doc.organizationId = ctx.organizationId;
  });
}

# Engineering / Contribution Guide

**Status: current.** How to add functionality to this codebase without
bypassing its architecture. Read [`docs/architecture/overview.md`](../architecture/overview.md)
first if you haven't — this page assumes it.

---

## 1 · The layering rule

```
API route → Service → Repository → Model
```

- **Routes** (`app/api/**/route.ts`) parse/validate the request, call
  **one** service method, map the result to a response. No business
  logic in a route file.
- **Services** (`lib/services/**`) hold all business logic. A service
  calls repositories, never Mongoose or the in-memory store directly.
- **Repositories** (`lib/db/repositories/**`) are the only code that
  touches Mongoose/the in-memory store. One Mongo implementation + one
  in-memory implementation per entity, behind the same TypeScript
  interface, selected by `lib/db/registry.ts`.

Adding a new entity means adding all four layers — never skip the
repository layer "just this once" to call Mongoose directly from a
service; that's exactly the pattern that made tenant isolation
enforceable by construction (§4 below) instead of by convention.

## 2 · Repository Pattern — both implementations, always

Every repository interface needs **both** a Mongo and an in-memory
implementation. The in-memory one exists so the app runs with zero
configuration locally and in CI — it is not optional or a "just for
tests" afterthought. Two class-of-bug traps to know about, found
repeatedly across this project's history:

- **Mongoose silently strips `undefined`-valued keys from an update.**
  `repo.update({field: undefined})` no-ops against real MongoDB but
  actually sets the field to `undefined` against a naive in-memory
  `Object.assign`-based implementation — the two backends diverge
  silently unless you test against both. Use a dedicated method (e.g.
  `clearField()`) doing a real `$unset` when you need to actually
  clear a field, not "assign undefined."
- **In-memory repositories often return the SAME mutable object** they
  store internally (`Object.assign(existing, patch); return existing;`
  is the established convention). If a caller captures that return
  value and later calls the same repository method again on the same
  entity, the first captured reference may already reflect the second
  call's mutation. Snapshot any value into a primitive immediately if
  it needs to survive a later mutating call.

## 3 · Validation

Hand-rolled per-service `validateXInput(input: unknown)` functions
(`lib/services/*/validation.ts`) — not a schema library (no Zod-first
convention in this codebase, despite `zod`/`zod-validation-error`
appearing as transitive dependencies of something else). Every
validator: checks `typeof input === "object"`, builds an array of
`{field, message}` errors, returns `{valid: true, data} | {valid:
false, errors}`. Follow this exact shape for a new validator — routes
already expect it (`ValidationApiError`/`apiError()`).

## 4 · Tenant context — never bypass it

A new tenant-owned entity's Mongoose model needs
`schema.plugin(tenantScopePlugin)` — see
[`docs/architecture/tenant.md`](../architecture/tenant.md#3--which-entities-are-tenant-scoped)
for the current list of which entities have it and why 13 deliberately
don't. **Never manually add an `organizationId` filter to a query as a
substitute** — that's exactly the "developer discipline at 300+ call
sites" pattern this plugin exists to make unnecessary. If you find
yourself writing `.find({organizationId, ...})` inside tenant context,
something's wrong — the plugin should already be doing that.

## 5 · RBAC

Adding a new route: choose `requiredRole` (tenant rank) and/or
`requiredPlatformRole` (platform axis) — **never** invent a third axis
or a role name not in `UserRole`/`PlatformRole`
(`lib/services/auth/types.ts`). If a route needs a commercial-plan
gate, use `requiredCapability`, a genuinely separate concept from role.
See [`docs/architecture/rbac.md`](../architecture/rbac.md).

**Every new authenticated route prefix must be added to
`middleware.ts`'s `matcher` array** — this is a hand-maintained
allowlist, not a wildcard-everything default. A route outside the
matcher gets zero header verification; a client's raw `x-auth-*`
headers reach the handler unstripped. This exact bug class has
recurred multiple times in this project's history (RC-1's own new auth
routes, RC-7's onboarding routes, RC-8's own docs routes) — always add
the new prefix in the same change that adds the route, and verify live
(register a fresh account, confirm you get rejected/accepted as
expected) before considering the route done, not just by reading the
code.

## 6 · Audit logs

Real, meaningful business events only — not every read, not every
duplicate/no-op. `AUDIT_ACTIONS`/`SECURITY_AUDIT_ACTIONS`
(`lib/services/auditLog/actions.ts`) are the closed catalog; add a new
constant there, never a raw string at the call site. If you add a new
`entityType`, update **three** places together (this has bitten this
project multiple times when only one or two were updated): the
TypeScript `AuditEntityType` union, the Mongoose schema's own
hand-maintained enum (`lib/db/models/auditLog.model.ts`), and the
guard test (`auditLog.model.unit.test.ts`) that exists specifically to
catch a future omission of either.

## 7 · Queue usage

Need something to run asynchronously? Register a job handler
(`registerJobHandler(jobType, handler)`) and enqueue a `ScheduledJob` —
never build a second scheduling mechanism. See
[`docs/integrations/automation.md`](../integrations/automation.md#6--queue-retry-dlq)
and `RUNBOOK.md`/`DR_RUNBOOK.md` for replay-safety classification if
your job type has a real-world side effect (a message send, a charge) —
classify it explicitly (SAFE TO REBUILD / MUST RECOVER / MUST NOT
REPLAY AUTOMATICALLY) rather than leaving it unclassified.

## 8 · Credential resolver

A new provider integration that needs per-tenant credentials: reuse
`lib/services/tenantCredentials/`'s resolver — check
`getTenantContext()?.organizationId` against it before falling back to
a deployment-wide env default (Module 8.2's established pattern, now
used by WhatsApp/Email/AI/Calendar). Never invent a second per-tenant
credential store. Never return a raw credential value in an API
response — only Configured/Missing/Expired-style status.

## 9 · Existing UI components

The admin app has an established design system and component library
(`components/admin/`). A new admin page reuses these rather than
introducing a second visual language — see any recent RC's own "never
redesign the existing app" instruction (RC-6, RC-7 both restate this
explicitly for their own new surfaces). `useAdminData()` is the
established fetch-on-mount hook — use it instead of a hand-rolled
`useState`+`useEffect` pattern, which tends to violate this codebase's
`react-hooks/set-state-in-effect` lint rule.

## 10 · Before calling something done

- `npx tsc --noEmit` clean
- `npm run lint` clean (no new problems — check against the
  pre-existing baseline, currently ~84 problems in unrelated files,
  see [`docs/development/testing.md`](testing.md))
- `npm run test:unit` and `npm run test:e2e` both clean
- New route added to `middleware.ts`'s matcher if it's authenticated
  (§5)
- New tenant-owned entity has `tenantScopePlugin` (§4)
- Live-verified in a real browser against real data, not just
  automated tests — this project's own recurring pattern (see any RC
  audit's own live-verification section) has found real bugs automated
  tests missed, repeatedly

See also [`safety-rules.md`](safety-rules.md) for the specific
invariants that must never be violated, and
[`../development/adr/`](adr/) for why several architectural choices
here are the way they are.

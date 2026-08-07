# ADR-0002: Tenant isolation via `AsyncLocalStorage` + a Mongoose query plugin

**Status: Accepted, implemented (Module 8.1).**

## Context

This app became multi-tenant well after its CRM data model already
existed (Phases 0–7 predate Phase 8). Retrofitting `organizationId`
filtering by convention — requiring every one of ~300+ existing and
future call sites across services and routes to remember to pass and
filter by it — is exactly the shape of mistake that produces a
cross-tenant data leak the first time someone forgets.

## Decision

A single `AsyncLocalStorage<TenantContext>` (`lib/tenancy/context.ts`),
established once per request (`withApiRoute.ts`) or once per background
job (the scheduler/automation engine), carrying `{organizationId,
userId, role}`. A Mongoose plugin (`tenantScopePlugin`) and an
equivalent in-memory-store helper read this ambient context and
auto-merge `organizationId` into every query on every model it's
applied to — no service method needs an explicit `organizationId`
parameter threaded through its signature.

## Consequences

- Tenant scoping became a property of the **data-access layer**, not
  developer discipline at every call site — a new route/service
  function gets tenant isolation "for free" as long as it runs inside
  `runWithTenantContext()`, without needing to remember to filter.
  Every existing route already runs there once `withApiRoute()`
  resolves an `organizationId`.
- The trade-off is explicit and disclosed: with **no** context active
  (a script, a migration, code that predates this module), the plugin
  is a **no-op** — real protection only for the request/job paths this
  app actually serves traffic through, proven by a dedicated
  cross-tenant attack test suite
  (`tests/e2e/tenantIsolation.spec.ts`), not a database-level guarantee
  independent of the application calling `runWithTenantContext()`
  correctly.
- 13 of 51 models are deliberately excluded (`User`, `Organization`,
  `RefreshToken`, `ScheduledJob`, `Plan`, and 8 more identity/system
  entities) — see
  [`docs/architecture/tenant.md`](../../architecture/tenant.md#3--which-entities-are-tenant-scoped)
  for the full, reasoned list.
- A genuinely cross-tenant read (Platform Admin aggregates) needs a
  deliberate escape hatch (`runCrossTenantSweep()`) rather than simply
  omitting the context — keeping "I meant to see every organization"
  visually distinct from "I forgot to scope this."

# Testing

**Status: current.** 90 unit test files, 32 E2E spec files as of RC-8
(2026-08-05) — 818 unit tests / 142 E2E tests passing at RC-7's close;
run the suites yourself for the current count rather than trusting a
number here, which will drift.

---

## 1 · Unit tests (Vitest)

```bash
npm run test:unit
```

Convention: `*.unit.test.ts`, colocated next to the file it tests
(e.g. `lib/services/auth/authService.unit.test.ts`). No external
dependencies needed — runs against in-memory repositories and mocked
providers. Covers:

- Service-layer business logic (validation, scoring, entitlement math)
- **Deliberate concurrency tests** — real `Promise.all`-driven races
  proving atomic-counter/idempotency code is actually safe under
  genuine concurrent execution in Node's single-threaded event loop
  (not a code-review assumption) — see e.g.
  `lib/services/billing/usageService.unit.test.ts`.
- RBAC gate logic (`lib/api/roles.unit.test.ts`,
  `lib/api/withApiRoute.unit.test.ts`)
- Regression guard tests for specific found-and-fixed bugs (e.g.
  `auditLog.model.unit.test.ts` guards against the "new entity type
  added to the TS union but not the Mongoose enum" bug class, which
  has recurred multiple times in this project's history)

## 2 · E2E tests (Playwright)

```bash
npm run test:e2e
```

Real HTTP requests against a real running Next.js production-mode
server (`playwright.config.ts`'s own `webServer`), `MONGODB_URI=""`
(in-memory store, sequential `workers: 1`, a fixed test
`JWT_ACCESS_TOKEN_SECRET`). Covers every major feature area's critical
path plus deliberate security testing:

- 3-tier RBAC (`counsellor`/`manager`/`admin`) across the whole admin
  surface
- **Cross-tenant isolation** (`tests/e2e/tenantIsolation.spec.ts`) —
  two real organizations, proving Org B cannot read/write Org A's data
  for every tenant-scoped entity
- **Pentests** — forged trusted-header injection attempts, IDOR via
  crafted ids, token replay, expired/revoked token reuse — see
  `tests/e2e/platformSuperAdmin.spec.ts` and `tests/e2e/onboarding.spec.ts`
  for concrete examples
- Real provider-adjacent flows where safe to simulate without a live
  vendor account (webhook signature verification, campaign scheduling)

### Minting a test session without a real login

`tests/e2e/helpers.ts`'s `addSessionCookie()` mints a JWT-signed
cookie matching the exact contract `middleware.ts` verifies — there is
no way to seed a real `User` into the `webServer`'s own in-memory
process from the separate Playwright test process (different Node
processes, different in-memory stores), so this is how every E2E spec
gets a working session without going through a real login. Passing
`organizationId: null` explicitly mints the exact shape a
mid-registration RC-7 user's token has (no org claim yet) — omitting
the option entirely resolves the deployment's real default organization
via one live HTTP bootstrap call, not a fabricated placeholder id (see
that file's own extensive doc comment for why both matter and the
regression this fixed).

## 3 · Security tests

Not a separate suite — folded into E2E (see the pentest bullet above)
and into targeted unit tests for token/crypto-adjacent code (JWT
verification edge cases, encryption round-trip tests, password-hash
comparison). `docs/security/overview.md` links to the concrete spec
files for each control.

## 4 · Tenant tests

`tests/e2e/tenantIsolation.spec.ts`,
`tests/e2e/tenantCredentials.spec.ts`,
`tests/e2e/tenantBranding.spec.ts`,
`tests/e2e/tenantWhatsAppEmbeddedSignup.spec.ts` — each proves the
same standard: two real organizations, real writes, real HTTP,
confirming zero cross-tenant leakage for that specific domain.

## 5 · Queue / scheduler tests

Unit-level: `lib/services/scheduler/schedulerService.unit.test.ts`
(atomic job claiming, stale-claim reclaim, retry backoff math) using
fake timers and mocked handlers, not a real waiting queue. There is no
dedicated E2E queue test — job execution is exercised indirectly
through feature specs that depend on a job completing (e.g. a
WhatsApp campaign send).

## 6 · Required infrastructure

| Suite | Needs |
|---|---|
| `test:unit` | Nothing — self-contained |
| `test:e2e` | Nothing extra — Playwright's own `webServer` starts a real Next.js instance with `MONGODB_URI=""` automatically |
| Live-provider verification (not part of either automated suite) | A real MongoDB replica set + real vendor credentials — see [`local-development.md`](local-development.md#3--mongodb-optional-for-basic-dev-required-for-real-persistence) and [`docs/integrations/matrix.md`](../integrations/matrix.md) |

## 7 · Regenerating generated docs

`docs/api/openapi.json` (and the table in
[`docs/api/inventory.md`](../api/inventory.md)) is generated, not
hand-maintained:

```bash
npx tsx scripts/docs/generateOpenApiSpec.ts
```

Run this after changing any route's `withApiRoute()` registration
(new route, changed role/capability/rate limit).

## 8 · Known, disclosed flakes

Two pre-existing E2E flakes have recurred across multiple RC passes,
each confirmed non-deterministic (not a real regression) by passing
cleanly on an isolated re-run every time they've appeared:
`crm-settings.spec.ts`'s assignment-rule panel test, and
`lead-capture.spec.ts` (a single one-off failure in a full-suite run,
never reproduced since). If either fails in your own run, re-run it in
isolation before treating it as a regression.

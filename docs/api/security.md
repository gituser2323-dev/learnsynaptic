# API Security Model

**Status: current.** Read alongside
[`docs/architecture/overview.md`](../architecture/overview.md) (the
exact request-lifecycle check ordering) and
[`docs/security/overview.md`](../security/overview.md) (the broader
security architecture, RC-1/RC-2). This document is the API-surface-
specific slice of that.

---

## 1 · Response envelope (uniform across every route)

```json
// success
{ "success": true, "...payload fields": "..." }

// error
{ "success": false, "errors": [{ "field": "email", "message": "Email is required." }] }
```

Every route returns this shape (`lib/api/response.ts`'s
`apiSuccess()`/`apiError()`) — never a bare array, never an
inconsistent error shape between routes. `errors` is always an array
(usually one entry, sometimes one per invalid field on a validation
failure). `field: "root"` means the error isn't attributable to one
specific input field.

## 2 · Authentication

Session-cookie JWT (`ls_access_token`, `httpOnly`, `SameSite=Lax`),
verified by `middleware.ts` at the Edge for every route covered by its
`matcher` array — **a route outside that matcher gets no verification
at all** for client-supplied `x-auth-*` headers. Two other
authentication shapes exist for the handful of routes with no browser
session:

| Mechanism | Used by |
|---|---|
| `CRON_SECRET` bearer token | `/api/cron/run-due-jobs` only |
| `PLATFORM_ADMIN_SECRET` bearer token | Additionally required (on top of an admin session) for the 2 global Plan-catalog write routes (`admin.billing.plans.create`, feature-flag writes) |
| Provider signature | Inbound webhooks — see [`webhooks.md`](webhooks.md) |
| None (genuinely public) | `POST /api/leads`, `POST /api/registrations`, `GET /api/health*`, health/marketing read routes |

Full detail: [`docs/architecture/auth.md`](../architecture/auth.md).

## 3 · Authorization

Two independent axes, both enforced server-side inside
`withApiRoute()` before any handler code runs — see
[`docs/architecture/rbac.md`](../architecture/rbac.md) for the full
matrix:

1. **Tenant role** (`requiredRole`) — rank-based (`counsellor <
   manager < admin`).
2. **Platform role** (`requiredPlatformRole`) — a structurally separate
   check that never reads tenant `role`; additionally requires MFA
   enabled on the acting account, verified with a real DB read on
   every request.

A third, narrower gate exists for commercial features:
`requiredCapability` (`lib/services/billing/`'s entitlement layer) —
rejects with `403` and a `PlanEntitlementRequiredApiError` when the
organization's plan doesn't include a capability. Only wired at 5
representative call sites today (seats, WhatsApp send, automation
execution, AI requests, file storage) — a disclosed, not-yet-universal
scope.

## 4 · Tenant scope

An authenticated request's `organizationId` comes **only** from a
verified JWT claim — never a request body/query param/header a client
controls. A request with no resolvable `organizationId` is rejected
outright from every route except `auth.*`/`onboarding.*`/platform-
gated ones. See
[`docs/architecture/tenant.md`](../architecture/tenant.md) for the
full mechanism and which entities are actually tenant-scoped.

## 5 · Rate limiting

Per-route, per-client-IP (`lib/api/rateLimit/inMemory.ts`),
`limit`/`windowMs` configured individually per route (see the "Rate
limit" column in [`inventory.md`](inventory.md)) — most authentication-
adjacent routes (login, register, forgot-password) use a tighter
window (5–10 requests/15min) than ordinary CRUD routes (30–60/min).
**This limiter is in-memory, per serverless instance** — it bounds
abuse from a single client hitting a single warm instance; it is not a
distributed, cross-instance rate limit. A `429` response includes a
computed `Retry-After` derived from the limiter's own reset time.

## 6 · Idempotency

There is **no** generic `Idempotency-Key` header mechanism across the
API. Idempotency is handled per-domain, where it matters, by a real
mechanism — not a client-supplied key the server has to trust:

- **Lead creation** (`POST /api/leads`) — deduplicates on
  phone/email, updating the existing record rather than creating a
  duplicate.
- **Registration** (`POST /api/registrations`) — same dedup shape.
- **Payment webhooks** — a real DB-enforced partial unique index on
  `(provider, providerEventId)`, closing a genuine check-then-insert
  race found via concurrency testing during RC-3 (two truly concurrent
  deliveries of the same event could otherwise both pass a dedup read
  before either finished writing).
- **Onboarding organization creation** — re-checking for an existing
  organization on the calling user before creating a new one.
- **Team invitation acceptance** — re-checks seat limit and email
  uniqueness at accept time, not just at send time (race-safe against
  two invites near a seat boundary).

A route with no such mechanism (most ordinary admin CRUD writes) is
**not** safe to blindly retry on ambiguous failure (e.g., a timeout
after the request reached the server) — check the specific route's own
source before assuming a retry is safe.

## 7 · Webhook signatures

Covered in full in [`webhooks.md`](webhooks.md) — not duplicated here.

## 8 · What this API does NOT have

- No API keys / developer tokens for third-party integrations against
  this app's own admin API (only session cookies + the two bearer
  secrets in §2).
- No GraphQL, no gRPC.
- No dedicated CSRF token — `SameSite=Lax` plus an explicit same-origin
  check (`isSameOriginRequest()`) on the genuinely public mutating
  routes is this app's uniform CSRF defense across the whole admin
  surface, reviewed and found consistent, not a gap this or any prior
  RC pass introduced. See
  [`docs/security/overview.md`](../security/overview.md).

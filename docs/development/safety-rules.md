# Coding Safety Rules

**Status: current.** Non-negotiable invariants for this codebase — a
violation of any of these is a real security or correctness bug, not a
style preference. Each rule below states *why*, and points at the real
mechanism that enforces (or should enforce) it, so a future change can
be checked against the actual reasoning, not just the rule's words.

---

## NEVER trust a browser-supplied `organizationId`

A request's tenant identity comes **only** from a JWT claim verified by
`middleware.ts`, converted into a trusted `x-auth-org-id` header —
never a request body field, query param, or client-supplied header.
`getAuthContext()` (`lib/api/roles.ts`) reads exclusively from those
trusted headers. If you ever find code reading `organizationId` from
`request.json()` or a query string to decide *whose* data to touch,
that's the exact cross-tenant vulnerability class this whole
architecture exists to prevent. See
[`docs/architecture/tenant.md`](../architecture/tenant.md#9--the-security-boundary-stated-plainly).

## NEVER query tenant data without tenant scope

Every tenant-owned Mongoose model applies `tenantScopePlugin`, which
auto-injects `organizationId` into every query **when a tenant context
is active**. With no context active (a script, a migration, code
running outside `runWithTenantContext()`), the plugin is a **no-op** —
an unscoped query against a tenant-owned collection returns every
organization's rows. Never write a script or one-off tool that queries
a tenant-owned collection without either (a) wrapping it in
`runWithTenantContext({organizationId}, ...)` for a specific org, or
(b) using the deliberate `runCrossTenantSweep()` escape hatch when a
genuine cross-tenant read is the actual intent (Platform Admin
aggregates only). See
[`docs/architecture/tenant.md`](../architecture/tenant.md#2--tenant-context--the-enforcement-mechanism).

## NEVER expose raw credentials

A tenant credential (WhatsApp/Email/AI API key, OAuth token) is
encrypted at rest and **never** returned to the browser after being
saved — every credential-status API reports Configured/Missing/
Expired/Reconnect-Required, never the value itself. This applies
equally to Platform Admin views — an operator sees the same
Configured/Missing status a tenant sees, never a raw secret, even with
`platformRole: "super_admin"`. Logs and audit entries record credential
**key names**, never values.

## NEVER bypass entitlement checks

A route or service function that gates a commercial-plan capability
must go through `entitlementService.hasCapability()`/
`assertCapability()` (via `requiredCapability` on `withApiRoute`, or a
direct call at the service layer) — never a hardcoded plan-name string
comparison (`if (plan.name === "Pro")`). Plan names are not stable
identifiers a feature should hardcode against; capabilities are.

## NEVER execute an external side effect without considering idempotency

Sending a WhatsApp message, charging a payment, delivering a webhook —
any code with a real external side effect must be checked against
RC-5's replay-safety classification (SAFE TO REBUILD / MUST RECOVER /
MUST NOT REPLAY AUTOMATICALLY, see `DR_RUNBOOK.md` §10) before being
wired into anything that could plausibly retry or replay it (a queue
retry, a restored backup, a replayed webhook delivery). A
check-then-insert pattern (read for an existing record, then write) is
**not** safe under real concurrency by itself — this codebase has found
a genuine production race this way before (payment webhook dedup, RC-3)
— use a real DB-enforced unique constraint for anything that must never
double-fire.

## NEVER manually duplicate integration architecture

A new provider integration (a new WhatsApp vendor, a new payment
gateway, a new AI vendor) implements the existing generic interface
(`WhatsAppProvider`/`PaymentProvider`/`AiProvider`/etc.) and registers
in the existing Provider Registry (Module 6.1) — never a second,
parallel "just for this vendor" connection/config/health system. See
[`docs/development/contributing.md`](contributing.md#8--credential-resolver).

## NEVER add a new authenticated route without updating `middleware.ts`'s matcher

Stated once in full in
[`contributing.md`](contributing.md#5--rbac) — repeated here because
it's the single most-recurring real bug class in this project's
history (found and fixed at least three separate times across RC-1,
RC-7, and RC-8). A route outside the matcher trusts nothing it
shouldn't, but also verifies nothing it should — `getAuthContext()`
sees no trusted headers at all for it, so `requiredRole`/
`requiredPlatformRole` checks silently treat every request as
unauthenticated rather than actually failing open to a forged claim.
Verify live (a real registered/logged-in session actually reaching the
route) before considering a new authenticated route done — this bug
class does not reliably show up in a code read alone.

## NEVER commit or log a real secret

No real API key, MongoDB URI with credentials, JWT secret, or webhook
secret in a commit, a log line, an error message returned to a client,
or a markdown file. `.gitignore` excludes every `.env*` file already;
`.env.example` uses only safe placeholders. See
[`docs/security/overview.md`](../security/overview.md) for the logging
redaction convention.

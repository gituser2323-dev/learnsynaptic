# Security Architecture

**Status: current.** Covers RC-1 (Authentication & Identity) and RC-2
(Enterprise Security Hardening), as extended by every later RC pass.
This page describes what controls exist and why — it does not walk
through exploit techniques or specific bypass attempts; those live in
each RC's own audit file (`RC_6_AUDIT.md`, `RC_7_AUDIT.md`, ...) as
**proof the control works**, written for an engineering audience
already inside this codebase, not republished here.

---

## 1 · Authentication

Stateless JWT (access + refresh), `httpOnly`/`SameSite=Lax` cookies,
real RFC 6238 TOTP MFA with email-OTP fallback and trusted-device
support, per-account brute-force lockout independent of per-IP rate
limiting. Full detail: [`docs/architecture/auth.md`](../architecture/auth.md).

## 2 · Authorization (RBAC + platform role)

Two independent axes (tenant role, platform role), both enforced
server-side before any handler runs, never inferred from a
client-supplied value. Full detail:
[`docs/architecture/rbac.md`](../architecture/rbac.md).

## 3 · Tenant isolation

`AsyncLocalStorage`-based context + a Mongoose query plugin
auto-scoping every tenant-owned query — see
[ADR-0002](../development/adr/0002-tenant-isolation-via-async-local-storage.md)
and [`docs/architecture/tenant.md`](../architecture/tenant.md). Proven
by a dedicated, real cross-tenant attack test suite
(`tests/e2e/tenantIsolation.spec.ts` and its per-domain siblings) —
two real organizations, real HTTP requests, confirming zero leakage.

## 4 · Encryption at rest

Four independent AES-256-GCM keys, one per purpose (tenant
credentials, webhook secrets, calendar OAuth tokens, MFA secrets) — see
[ADR-0005](../development/adr/0005-per-purpose-credential-encryption-keys.md).
Decryption fails loudly on a wrong key, never silently returns garbage.
No key-versioning/rotation mechanism exists today — a disclosed gap
(`DR_RUNBOOK.md` §9).

## 5 · Credential storage & exposure

A tenant credential is never returned to the browser after being
saved — every credential-status API (tenant-facing or Platform Admin)
reports Configured/Missing/Expired/Reconnect-Required, never a raw
value. Audit log entries for credential changes record key **names**
only (`{providerId, keys: ["apiKey"]}`), never values.

## 6 · Rate limiting

Per-route, per-client-IP, in-memory (bounds a single warm serverless
instance, not a distributed cross-instance limit) — see
[`docs/api/security.md`](../api/security.md#5--rate-limiting) for the
concrete numbers per route category.

## 7 · CSRF

No dedicated CSRF token exists anywhere in this codebase. The uniform
defense is `SameSite=Lax` session cookies plus an explicit same-origin
check (`isSameOriginRequest()`) on the small number of genuinely public
mutating routes that run before any session could exist (registration,
lead capture, login itself). Reviewed multiple times across RC passes
(RC-6 §15.14, RC-7) and found consistent across the whole admin
surface — a real, disclosed characteristic, not a gap any specific
pass introduced. A dedicated CSRF-token hardening pass remains a
reasonable future candidate if the threat model ever calls for
defense-in-depth beyond `SameSite`.

## 8 · Security headers

`next.config.ts` sets a real Content-Security-Policy (scoped to the
actual external domains this app talks to — GA4, Meta Pixel — not left
wide open), HSTS, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY` + `frame-ancestors 'none'`, a restrictive
Permissions-Policy (every browser capability this app doesn't use is
explicitly denied), `Cross-Origin-Opener-Policy`, and
`X-Permitted-Cross-Domain-Policies: none`. One route
(`/api/docs/reference`, the internal API documentation UI, RC-8) gets a
narrowly-scoped CSP addition for one pinned, versioned CDN script — see
that route's own doc comment and `next.config.ts`'s
`API_DOCS_CSP_DIRECTIVES` for why it's scoped to that one path only.

## 9 · File upload security

Per-category size/MIME limits, a hard dangerous-extension/MIME
blocklist, best-effort magic-byte sniffing, and path-traversal defense
via a fresh `randomUUID()` storage key (never derived from a client-
supplied filename). Optional pluggable virus scanning
(`VIRUS_SCAN_PROVIDER=clamav`, disabled by default — uploads are
accepted unscanned when disabled, logged as a one-time startup
warning). Real `Content-Disposition` headers on downloads close a
stored-XSS-via-upload vector RC-2 found and fixed.

## 10 · Logging & redaction

Structured logs (`lib/logger.ts`) never include a raw credential value,
password, or token — only key names/ids and outcomes. Security-
relevant events (forbidden access attempts, login failures, MFA
changes) additionally write to a dedicated security audit trail
(`securityAuditLogService`) distinct from the general business
`AuditLog` — see `AUDIT_ARCHITECTURE.md`.

## 11 · Audit logging

Every sensitive action — and every **forbidden attempt** at one — is
recorded with actor, target, action, timestamp, and safe metadata.
This applies uniformly across tenant actions, RBAC rejections, and
Platform Super Admin actions (RC-6). See
[`docs/architecture/database.md`](../architecture/database.md#5--audit-logging)
for the schema-consistency guard this relies on.

## 12 · Dependency & build hygiene

`npm audit --audit-level=high` runs in CI on every push. Real CVEs
found in prior passes were fixed via semver-safe `npm audit fix`, never
silently ignored. A real client-bundle secret scan (grepping
`.next/static/` for the literal value of every configured server-only
secret) is part of this project's own established release checklist —
see `RC_4`'s own CHANGELOG entry for the methodology.

## 13 · Reporting a security concern

This is an internal project without a public bug-bounty program at
this time. If you find a real vulnerability while working in this
codebase, report it directly rather than filing it as a public issue —
the same disclosure discipline every prior RC pass's own pentest
findings were held to (fixed before being written up, never left open
in a public-facing document).

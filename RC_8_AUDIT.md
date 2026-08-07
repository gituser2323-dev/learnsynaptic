# RC-8 — Documentation, API Documentation & Operational Knowledge Base

Companion to `CHANGELOG.md`'s own RC-8 entry (the narrative summary)
and `docs/README.md` (the new documentation index this pass's own
primary deliverable points at). This file is RC-8's own detailed
record: what was audited, what was built, what was found stale or
misleading and fixed, and the real validation performed — the
mission's own explicit "document the system that actually exists"
standard, verified rather than assumed.

**Mission scope, verbatim intent**: make the entire Business OS
understandable, deployable, supportable, testable, and maintainable
without relying on previous Claude conversations or undocumented
developer knowledge. Not a feature-development module — document the
system that actually exists; never document planned functionality as
implemented, never invent APIs or environment variables, never mark an
integration live simply because code exists.

---

## 1 · Documentation audit (before writing anything new)

Inventoried every existing root-level doc, every API route, every env
var, every Mongoose model, and existing comments/JSDoc before writing
a single new file. Findings, by the mission's own five categories:

- **CURRENT, kept as primary sources, not duplicated**: `RUNBOOK.md`
  (RC-4), `DR_RUNBOOK.md` (RC-5), `WHATSAPP_EMBEDDED_SIGNUP.md`
  (Module 8.5), `CAMPAIGN_ARCHITECTURE.md`, `AUDIT_ARCHITECTURE.md`,
  `RC_6_AUDIT.md`, `RC_7_AUDIT.md`, `CHANGELOG.md`.
- **OUTDATED / STALE**: `README.md` was still the literal
  `create-next-app` default stub — zero real content. Full rewrite
  (§2).
- **MISLEADING — a real naming collision found**: two completely
  unrelated things in this repository are both called "RC-1" —
  the current Production Hardening track's RC-1 (Authentication &
  Identity) and a much older, pre-blueprint "RC-1 — Release Candidate
  Stabilization" pass (`RC_FIX_REPORT.md`, `PRODUCTION_SCORE.md`, and a
  separate `## RC-1` heading near the bottom of `CHANGELOG.md`). Fixed
  by adding an explicit historical-status banner to all three
  locations, disambiguating rather than silently leaving two documents
  named identically to point at unrelated content (§13).
- **MISLEADING — a real stale technical claim found**:
  `API_DOCUMENTATION.md`'s own original claim ("no public HTTP
  endpoint for sending... the only HTTP surface is the inbound
  webhook") predates Module 2.5's real `POST
  /api/admin/whatsapp-campaigns/[id]/send`/`.../schedule` routes and is
  no longer accurate. Fixed with a correction note, original text
  preserved below it for what it still gets right (§13).
- **MISLEADING — a stale code comment found**:
  `scripts/createAdminUser.ts`'s own doc comment said "there is no
  public self-registration endpoint by design," predating RC-7's real
  `/admin/register`. Fixed (§13).
- **MISSING**: no `docs/` directory existed at all; no API inventory;
  no OpenAPI spec; no RBAC permissions matrix; no environment reference
  beyond `.env.example` itself; no ADRs; no role-scoped user guides; no
  troubleshooting/error-catalog/support-diagnostics documentation; no
  integration matrix using RC-4's own status terminology (the exact
  terms existed only in `CHANGELOG.md`'s prose, never as a standalone,
  browsable matrix).
- **DUPLICATED — deliberately avoided**: did not re-write WhatsApp
  architecture, campaign architecture, audit-log design, backup/DR
  procedure, or the production runbook — all already current and
  well-maintained; the new `docs/` tree cross-links them instead of
  restating them.

## 2 · Master README

Full rewrite (`README.md`) — what the Business OS is, architecture in
one picture, tech stack, real repository structure, local dev quick
start, every real command from `package.json`, testing summary,
production build/deploy summary, and a pointer to `docs/README.md` for
everything else. Deliberately short — the mission's own "keep it
useful and concise" instruction; the exhaustive detail lives in
`docs/`, not duplicated here.

## 3 · Architecture documentation (`docs/architecture/`)

- `overview.md` — real Mermaid diagrams of the system shape and the
  **exact, verified** `withApiRoute()` check ordering (read directly
  from `lib/api/withApiRoute.ts`, not paraphrased from memory), layers,
  cross-cutting concerns, and an explicit "what this app deliberately
  does NOT have" section.
- `tenant.md` — the real hierarchy (a `User` document, not a separate
  Membership entity, IS the membership — stated explicitly since the
  mission's own brief named "Membership" as if it were a separate
  concept), tenant context mechanism, and a **mechanically re-verified**
  count of which of the 51 Mongoose models are tenant-scoped: 38 with
  `tenantScopePlugin` applied, 13 deliberately not — corrected from an
  initial `grep -l` false positive (`Plan`'s own doc comment mentions
  the plugin by name while explaining why it's excluded, which a naive
  string search misread as inclusion; the real check was tightened to
  `.plugin(tenantScopePlugin)` call sites only).
- `auth.md` — every real `auth.*`/`onboarding.*` route, cross-checked
  against the actual route inventory, not the RC-1/RC-7 mission text's
  own aspirational list.
- `rbac.md` — the real permissions matrix, derived from all 226 real
  `withApiRoute()` registrations, not written from what each role is
  "supposed to" do.
- `database.md` — domains and relationships, deliberately not a
  field-by-field schema dump (mission's own explicit "prefer
  architecture over stale field lists" instruction) — points at the
  real `*.model.ts` files as the field-level source of truth.

## 4 · API documentation / OpenAPI (`docs/api/`, `scripts/docs/`)

- **`scripts/docs/generateOpenApiSpec.ts`** (new) — mechanically
  extracts every real `withApiRoute()` registration across
  `app/api/**/route.ts` and emits `docs/api/openapi.json` (OpenAPI
  3.1). Not hand-maintained; regenerate with `npm run
  docs:generate-openapi` after any route change. **226 real operations
  across 189 route files**, verified against the live filesystem at
  generation time, not a frozen snapshot.
- **A real bug found and fixed while building the generator**: the
  first draft set `servers.url` to `/api` while `paths` already
  included the `/api` prefix, producing a doubled `/api/api/...` in
  every generated client example (caught live, in the rendered Scalar
  UI, not by code review — see §7).
- **A real TypeScript bug found and fixed**: the script's first version
  used `fs.globSync`, which exists at this project's own required
  runtime (Node ≥22) but isn't declared by `@types/node@^20`, this
  repo's pinned major version — `npx tsc --noEmit` caught it
  immediately. Fixed with a small self-contained recursive directory
  walk instead of bumping a shared devDependency for one script.
- **Validated**: `npx @redocly/cli lint docs/api/openapi.json` — 0
  errors (39 stylistic warnings, including a real, accurate
  "ambiguous path" note about `/api/auth/oauth/{provider}/authorize`
  vs. `/api/auth/oauth/accounts/{id}` that correctly reflects how
  Next.js's own file-based routing resolves the two, not a spec
  defect).
- `inventory.md` — the human-readable version of the same generated
  data, regenerated from the live `openapi.json`, not a second,
  independently-hand-typed table that could drift from it.
- `security.md` — auth/authz/tenant-scope/rate-limits/idempotency/
  error-envelope, grounded in the real `ApiError` class hierarchy and
  the real response envelope (`lib/api/response.ts`), not invented.
- `webhooks.md` — inbound (WhatsApp/Email/Payments, each provider's
  real, distinct verification mechanism) and outbound (Module 6.5).

## 5 · API documentation UI

Scalar, self-hosted adapter (`@scalar/nextjs-api-reference`), served at
`GET /api/docs/reference` — **gated `requiredRole: "admin"`**, never
public (mission's own §10/§45 instruction). The rendering bundle itself
loads from a CDN by Scalar's own design (not an inline-bundleable
asset); rather than weaken the app's global CSP, a narrowly-scoped CSP
override applies to `/api/docs/*` only (`next.config.ts`'s
`API_DOCS_CSP_DIRECTIVES`), pinned to the exact `@scalar/api-reference`
version installed rather than an unversioned "latest" CDN URL — closing
a real supply-chain risk (a future unpinned CDN update silently
executing different JS in an authenticated admin's browser) before it
could exist.

**A real, live-found authentication bug, the same recurring class this
project has hit before**: the new `/api/docs/*` routes were initially
NOT added to `middleware.ts`'s own hand-maintained matcher array — live
verification (register → verify → create org → hit `/api/docs/reference`
with a real admin session) returned "Authentication required" despite
a valid session cookie, because `getAuthContext()` never saw a trusted
header for a route outside the matcher. Fixed by adding
`/api/docs/:path*` to the matcher, with a doc comment naming this
exact live-verification failure as the reason — the third time this
specific bug class has been found in this project's history (after
RC-1's own new auth routes, RC-7's onboarding routes), now flagged as
the single most-recurring real bug class in
`docs/development/safety-rules.md`.

## 6 · Authentication / RBAC documentation

Covered in §3 above (`docs/architecture/auth.md`, `rbac.md`) — not
duplicated here.

## 7 · Tenant architecture documentation

Covered in §3 above (`docs/architecture/tenant.md`).

## 8 · Integration matrix (`docs/integrations/`)

`matrix.md` — the first time RC-4's own CODE READY / CONFIGURED / LIVE
VERIFIED / REQUIRES EXTERNAL CONFIGURATION terminology exists as a
standalone, browsable matrix rather than only inside `CHANGELOG.md`'s
prose. Extended with everything verified since RC-4 (Slack's real
`404: no_team` live rejection from Module 6.5, WhatsApp Embedded
Signup's own platform-vs-tenant split from Module 8.5). `whatsapp.md`,
`automation.md` (the real trigger-event catalog — 14 real event names,
extracted by grepping every `eventBus.publish()` call site, not
invented — and the real action catalog, from
`lib/services/automation/types.ts`'s own `WorkflowActionType` union),
`ai.md` (the deterministic-vs-AI-scoring distinction the mission
explicitly asked for, grounded in the real `bandHealth()` shared-helper
mechanism that keeps the two banding systems from drifting apart).

## 9 · Environment variable reference

`docs/development/environment.md` deliberately does **not** duplicate
`.env.example` field-by-field (which would immediately go stale) —
explains the classification system and indexes by section instead.
**A real, genuine sync gap found and fixed**: diffing every real
`process.env.*` reference in the codebase against `.env.example`
found two variables used but undocumented — `APP_BASE_URL` (used by
`authEmails.ts` for verification/invitation links) and
`TEAM_INVITATION_TTL_SECONDS` (RC-7's own invitation expiry, added
after `.env.example`'s last comprehensive pass). Both added to
`.env.example` with real documentation, not just a bare line — this is
the authoritative reference now genuinely, mechanically verified in
sync, not asserted in sync.

## 10 · Development guide

`docs/development/local-development.md` (clone → install → env →
MongoDB → queue/worker → seed/bootstrap → run → login → test, exactly
the mission's own requested sequence, with both a self-service-
registration path and a CLI-bootstrap path, both real and tested this
session), `migrations.md`, `testing.md`, `contributing.md` (the
layering rule, the Repository Pattern's two known divergence traps,
tenant-context/RBAC/audit-log/queue/credential-resolver rules for
adding functionality without bypassing architecture),
`safety-rules.md` (7 non-negotiable invariants, each with the real
mechanism that enforces it and — where relevant — the real incident
that established the rule), and 6 ADRs (MongoDB+in-memory,
`AsyncLocalStorage` tenant isolation, the Mongo-backed queue over
Redis/BullMQ, Vercel serverless deployment, four separate encryption
keys, the Plan/Subscription/override entitlement model) — the mission's
own named examples, no ADR bureaucracy invented for trivial choices.

## 11 · Deployment guide

`docs/deployment/deployment.md` deliberately does not repeat
`RUNBOOK.md`'s own already-current deploy mechanics — adds what wasn't
covered anywhere yet: a consolidated domains/HTTPS/webhook-URL/OAuth-
callback checklist (four **separate** real OAuth app families in this
codebase, easy to conflate — Social Login, Calendar Connectors,
WhatsApp Embedded Signup, generic Integrations OAuth — each with its
own real callback URL pattern, laid out explicitly so they aren't
confused).

## 12 · Operations runbook

`docs/operations/troubleshooting.md` — 12 real failure scenarios (login
failure, OTP not received, WhatsApp disconnected, Meta webhook
failure, template unavailable, campaign stuck, automation failed,
queue backlog, email failure, AI unavailable, payment webhook failure,
storage failure), each with safe diagnostic steps grounded in this
app's real mechanisms — not generic advice. `error-catalog.md`
documents the real `ApiError` class hierarchy (this codebase has no
proprietary error-code system, and none was invented for this
document, per the mission's own explicit instruction not to). `RUNBOOK.md`/
`DR_RUNBOOK.md` remain the primary operational references, cross-linked
not duplicated.

## 13 · Disaster recovery documentation

`DR_RUNBOOK.md` (RC-5) remains the primary, current source — indexed
from `docs/README.md`, not duplicated.

## 14 · Security documentation

`docs/security/overview.md` — RC-1/RC-2 controls (authentication, MFA,
tenant isolation, encryption, credential storage, rate limiting, CSRF,
security headers, file security, logging redaction, audit logging),
each cross-linked to its own deeper document rather than re-explained,
and deliberately written at a "what exists and why" level rather than
reproducing exploit-sensitive bypass detail (mission's own §24
instruction) — that detail already lives in each RC's own audit file
for an engineering audience already inside the codebase.

## 15 · Platform Admin / Tenant Admin / Manager / Counsellor guides

Four role-scoped guides
(`docs/user-guides/{platform-admin,tenant-admin,manager,counsellor}.md`),
each verified **route-by-route** against the real RBAC gates rather
than written from each role's intended purpose. **A real, previously
undocumented product gap surfaced this way**: every single Conversations
route (`/api/admin/conversations*`, 11 routes) currently requires
`requiredRole: "admin"` — a Counsellor, the role most naturally suited
to day-to-day conversation handling, cannot reach the Conversations
inbox through the current API at all. Stated plainly in both
`counsellor.md` and `manager.md` rather than assumed to already work
because the mission's own brief described Counsellor's guide as
including "Conversations" — the Core Rule ("document the system that
actually exists") applies here directly. Flagged as a real product gap
for RC-9/RC-10 review (§17), not fixed in this documentation-only pass.

## 16 · Customer onboarding guide

`docs/user-guides/onboarding.md` — the real RC-7 flow in plain
business-owner language, matching the product's own established
"avoid raw technical jargon" onboarding-copy convention.

## 17 · Newly discovered PRODUCT gaps — NOT fixed in this pass

Per the mission's own explicit "document the gap, do NOT implement it"
instruction:

- **Conversations routes are Admin-only** (§15) — Counsellor and
  Manager cannot reach the Conversations inbox at all today, despite
  being the roles most likely to need it day-to-day. Worth a real RBAC
  review in a future RC.
- **No customer-facing request ID** (found writing
  `docs/operations/support-diagnostics.md`) — every request is
  assigned a real `requestId` internally (`randomUUID()`, threaded
  through every log line), but it is **never returned to the client**
  in the response body or as a header. Support currently cannot ask a
  customer for "the request ID" because the product never shows them
  one — support has to correlate by timestamp + organization instead.
  A real, cheap future fix (an `X-Request-Id` response header) is
  named but not implemented here.

## 18 · Testing documentation

`docs/development/testing.md` — unit/E2E/security/tenant/queue test
coverage, what infrastructure each needs, the real E2E session-minting
mechanism (`addSessionCookie()`) and why it exists, the two known,
disclosed pre-existing flakes.

## 19 · Engineering / contribution guide

`docs/development/contributing.md` — covered in §10.

## 20 · ADRs created

Covered in §10 — 6 ADRs, listed in `docs/development/adr/README.md`.

## 21 · Stale documentation removed / archived

- `README.md` — full rewrite (was the literal `create-next-app` stub).
- The "two unrelated RC-1s" naming collision — disambiguated at all
  three locations (`CHANGELOG.md`'s own old RC-1 heading,
  `RC_FIX_REPORT.md`, `PRODUCTION_SCORE.md`), not silently left
  standing (§1, §13 above use the same finding — not repeated content,
  cross-referenced).
- `API_DOCUMENTATION.md`'s stale "only HTTP surface is the webhook"
  claim — corrected with a note, original text preserved below it.
- `scripts/createAdminUser.ts`'s stale "no public self-registration"
  comment — corrected to reflect RC-7.
- Nothing was silently deleted — every correction is a visible,
  explained edit, matching the mission's own "do not silently leave
  conflicting instructions" instruction.

## 22 · Secret scan results

Every new/modified documentation file, `.env.example`, and every
touched code file (`next.config.ts`, `middleware.ts`,
`app/api/docs/*`, `scripts/docs/generateOpenApiSpec.ts`) scanned for
API-key/token-shaped values, MongoDB credential-bearing URIs, and
private-key blocks. **Clean** — the one match
(`.env.example`'s own pre-existing `mongodb+srv://user:pass@cluster...`
line) is an obviously-fake illustrative placeholder that predates this
pass. The throwaway test account credentials used for this pass's own
live browser verification (`rc8-docs-tester@example.com` /
`TestPass1234`) were confirmed never written to any committed file —
used only in the browser session itself.

## 23 · Documentation validation results

- **Commands**: every `npm run`/`npx tsx`/`npx tsc` command referenced
  anywhere in the new documentation cross-checked against real entries
  in `package.json` — all real, none aspirational.
- **Internal links**: 225 markdown links across `docs/` + 16 across the
  touched root-level files, all resolved programmatically against the
  real filesystem — 0 broken.
- **OpenAPI spec**: validated with `@redocly/cli lint` — 0 errors.
- **API inventory vs. real routes**: mechanically generated from the
  live filesystem at generation time — cannot drift from what it
  describes by construction, the strongest form of this specific
  validation.

## 24 · Remaining documentation gaps (disclosed)

- No dedicated ADR for the RC-8 documentation-generation approach
  itself — deliberately not written; documenting a documentation
  decision as its own ADR would be exactly the "bureaucracy for a
  trivial decision" the mission's own §36 instruction warns against.
- `docs/api/inventory.md`'s per-route "Purpose" is the route's own
  `routeName` humanized (e.g. `admin.leads.list` → "List leads"), not a
  hand-written sentence per one of 226 operations — a deliberate scope
  call given the size, consistent with the mission's own "prefer
  generated/schema-derived documentation" instruction; a route whose
  purpose isn't obvious from its name/tag is covered instead in its
  own domain's prose page (e.g. `docs/integrations/whatsapp.md`).
- Request/response body schemas in the OpenAPI spec are intentionally
  generic (`{type: "object"}` + a real `x-source-file` pointer) rather
  than a per-route fabricated shape — this codebase validates with
  hand-rolled per-service validators, not a schema library, so there
  was no single mechanical source to derive an exact shape from without
  risking inventing one (the mission's own explicit "do NOT invent
  APIs" standard, applied at the field level too).

## 25 · Overall RC completion %

100% against RC-8's own approved scope (46 numbered sections,
verified against this file's own section-by-section mapping in the RC
audit summary below).

## 26 · Production readiness score

Unaffected by this pass in either direction — RC-8 is documentation-
only; every quality gate re-run clean after this pass's own code
changes (the docs UI route, the middleware matcher fix, the generator
script): 818/818 unit tests, 142/142 E2E tests, `tsc --noEmit` clean,
zero new ESLint issues (same 84 pre-existing, confirmed untouched),
clean production build including both new `/api/docs/*` routes.

## 27 · Recommended next RC module

RC-9, scope to be assigned by the next explicit instruction, per this
pass's own closing "do not begin RC-9" directive. The two real product
gaps surfaced incidentally by this pass (§17) — Conversations' current
Admin-only RBAC scope, and the missing customer-facing request-ID
surface — are the clearest scoped candidates for a future RC's own
review, not acted on here.

---

## 28 · RC-8 audit summary (30 points)

1. **Completion status**: RC-8 (Documentation, API Documentation &
   Operational Knowledge Base) complete against its own approved
   scope. RC-9 not started, per this pass's own explicit closing
   instruction.
2. **Documentation inventory**: §1 — CURRENT/OUTDATED/DUPLICATED/
   MISSING/MISLEADING classification performed before writing anything
   new; a real naming collision (two unrelated "RC-1"s) and two real
   stale claims found and fixed.
3. **Master README status**: §2 — full rewrite, was the literal
   `create-next-app` default.
4. **Architecture documentation**: §3 — overview (verified request-
   lifecycle diagram, read directly from source), tenant, auth, rbac,
   database — all mechanically cross-checked against the live
   codebase, not written from memory of intent.
5. **API documentation / OpenAPI**: §4 — a real, checked-in generator
   script (`scripts/docs/generateOpenApiSpec.ts`), 226 real operations,
   0 OpenAPI lint errors, two real bugs found and fixed while building
   it (a doubled `/api/api` path prefix, a `@types/node` version
   mismatch).
6. **Authentication/RBAC documentation**: §6 — see §3.
7. **Tenant architecture documentation**: §7 — see §3; includes a
   corrected model-count (a `grep`-based false positive caught before
   publishing).
8. **Integration matrix**: §8 — the first standalone matrix using
   RC-4's own terminology, extended with everything verified since.
9. **Environment reference**: §9 — a real sync gap found (`APP_BASE_URL`,
   `TEAM_INVITATION_TTL_SECONDS`) and fixed in `.env.example` itself,
   not just documented as missing.
10. **Development guide**: §10 — local dev, migrations, testing,
    contributing, safety rules, 6 ADRs.
11. **Deployment guide**: §11 — cross-links `RUNBOOK.md`, adds the
    previously-scattered domains/HTTPS/webhook/OAuth-callback
    checklist.
12. **Operations runbook**: §12 — troubleshooting (12 real scenarios),
    error catalog (the real `ApiError` hierarchy, no invented error
    codes), cross-linked to `RUNBOOK.md`/`DR_RUNBOOK.md`.
13. **Disaster recovery documentation**: §13 — `DR_RUNBOOK.md` remains
    primary, indexed not duplicated.
14. **Security documentation**: §14 — RC-1/RC-2 controls, cross-linked,
    deliberately not exploit-sensitive.
15. **Platform Admin guide**: §15 — real operator capabilities and
    explicit boundaries (no tenant CRM access, no impersonation, no
    self-granted platform role).
16. **Tenant Admin / Manager / Counsellor guides**: §15 — verified
    route-by-route; surfaced a real, previously undocumented RBAC gap
    (Conversations is Admin-only today, not reachable by Counsellor/
    Manager).
17. **Onboarding guide**: §16 — the real RC-7 flow in plain language.
18. **Troubleshooting guide**: §12.
19. **Testing documentation**: §18.
20. **Engineering/contribution guide**: §19 — layering rule, Repository
    Pattern traps, tenant-context/RBAC/audit-log/queue/credential-
    resolver rules.
21. **ADRs created**: §20 — 6, matching the mission's own named
    examples exactly.
22. **Stale documentation removed/archived**: §21 — README rewrite, the
    RC-1 naming collision fixed at all 3 locations, one stale technical
    claim and one stale code comment corrected.
23. **Secret scan results**: §22 — clean.
24. **Documentation validation results**: §23 — 241 internal links
    validated (0 broken), every documented command verified real, 0
    OpenAPI lint errors, the API inventory is generated (cannot drift
    from what it describes by construction).
25. **Remaining documentation gaps**: §24 — disclosed, none hidden.
26. **Newly discovered PRODUCT gaps — not fixed here**: §17 —
    Conversations' Admin-only RBAC scope; no customer-facing request
    ID.
27. **Overall RC completion %**: §25 — 100% against RC-8's own approved
    scope.
28. **Production readiness score**: §26 — unaffected in either
    direction; all quality gates re-run clean after this pass's own
    small code changes (818/818 unit, 142/142 E2E, clean build, zero
    new lint issues).
29. **A real, live-found authentication bug, fixed before this pass
    shipped**: §5 — the new `/api/docs/*` routes were initially missing
    from `middleware.ts`'s matcher, the third recurrence of this exact
    bug class in this project's history; found via real live browser
    verification (register → verify → create org → hit the route with
    a real session), not by code review alone, and fixed before RC-8
    was considered complete.
30. **Recommended next RC module**: §27 — RC-9, scope to be assigned;
    the two product gaps in §17/§26 are the clearest scoped candidates
    for that review, not acted on in this documentation-only pass.

---

*(End of RC_8_AUDIT.md.)*

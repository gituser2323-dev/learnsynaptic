# RC-6 — Platform Super Admin & SaaS Operations Console

Companion to `CHANGELOG.md`'s own RC-6 entry (the narrative summary) and
`DR_RUNBOOK.md` (RC-5's own home document, whose architecture this pass
reuses rather than duplicates). This file is RC-6's own detailed record:
the platform authorization architecture, what was built, what was
deliberately deferred, and the real (not simulated) security testing
performed against it — the mission's own explicit "Do not declare
success simply because /platform renders" standard.

**Mission scope, verbatim intent**: build a brand-new PLATFORM OPERATOR
layer for the SaaS owner (LearnSynaptic itself) to manage every customer
organization on the deployment, completely separate from ordinary
tenant administration. A tenant Admin — even the highest tenant rank —
must NEVER gain Platform Super Admin privileges. The existing tenant
admin application was not redesigned; platform operations were never
mixed into normal tenant CRM navigation.

---

## 1 · Platform authorization architecture

**Core design decision**: `PlatformRole` is a **parallel, never
rank-compared** authorization axis from `UserRole`/`AdminRole`
(`counsellor` < `manager` < `admin`). There is exactly one value today:
`"super_admin"`. It is not position 4 on the existing rank ladder — it
answers a structurally different question ("is this a platform
operator for the whole deployment") from tenant role's ("what does this
user's rank allow inside their own organization").

- `lib/services/auth/types.ts` — `PlatformRole` type; `platformRole?`
  added to `User`, `PublicUser`, `UpdateUserInput`, and the signed
  `AccessTokenPayload`.
- `lib/db/models/user.model.ts` — `platformRole?: string`, schema
  `enum: ["super_admin"]` (so a raw DB write of an unrecognized value
  is rejected at the Mongoose layer too, not just at the application
  layer).
- `lib/services/auth/tokens.ts` — `signAccessToken` signs
  `platformRole` into the JWT when present; `verifyAccessToken` only
  ever returns it through a dedicated `isPlatformRole()` guard — an
  unrecognized/tampered claim value is dropped, never passed through.
- `lib/api/roles.ts` — `hasPlatformRole(context, required)`: an
  **exact-match** check that **never reads `context.role`** at all.
  This is the load-bearing property the mission's own "must never
  gain" requirement reduces to: the separation isn't a convention a
  future engineer has to remember, it's enforced by which field a
  function is even capable of reading. The same file's
  `AUTH_HEADER_PLATFORM_ROLE` trusted header carries the claim from
  `middleware.ts` (which verifies the JWT once, then re-derives every
  trusted header itself — a request can never smuggle its own
  `x-auth-platform-role`/`x-auth-role` header past `middleware.ts`,
  regardless of what a caller sends; see §8, pentest #2).
- `lib/api/withApiRoute.ts` — third gate option,
  `requiredPlatformRole?: PlatformRole`, independent of `requiredRole`
  and `requiredCapability`. A route setting it almost never also sets
  `requiredRole` — they answer unrelated questions.

**Why not a 4th rank on the existing ladder?** A rank-based design
would make "is this user privileged enough" a single sliding scale,
which is exactly the shape the mission explicitly forbade ("a tenant
Admin must NEVER gain Platform Super Admin privileges" — not "only
with sufficiently high rank"). Two independent booleans (tenant role
check, platform role check) can't accidentally collapse into one
comparison the way a single rank integer can.

## 2 · Bootstrap mechanism

There is **no HTTP route, public or admin-authenticated, that grants
`platformRole`.** The only way to create the first (or any) Platform
Super Admin is `scripts/bootstrapPlatformSuperAdmin.ts`, run from a
shell with deploy/operator access — the same precedent
`createAdminUser.ts`/`resetAdminPassword.ts` already established for
this codebase's other operator-only bootstrap actions.

- Requires the target account to **already exist** (created the normal
  way first) — this script only grants/revokes the platform claim, it
  never creates a user, keeping its blast radius minimal.
- Idempotent: granting an already-granted account is a safe no-op;
  `--revoke` clears the field.
- Every invocation writes a real audit log entry
  (`PLATFORM_SUPER_ADMIN_GRANTED`/`REVOKED`) — a CLI action still gets
  the same audit trail an HTTP action would.
- Usage: `npm run platform:bootstrap-super-admin -- <email>` /
  `-- <email> --revoke`.

## 3 · MFA requirement for the platform tier

`withApiRoute.ts`'s `assertPlatformMfaSatisfied()` does a **real DB
read** (`getUserRepository().findById()`) of the acting user's own
`mfaEnabled` flag on every `requiredPlatformRole` request — the one
gate in this file that pays for an extra lookup per request, justified
by MFA being the mission's own explicit requirement for the most
privileged account class in the system. Fails closed on every branch:
no matching user, or `mfaEnabled` false, both reject with a real 403
("Platform access requires multi-factor authentication to be enabled
on this account.") — there is no "couldn't check, so let it through"
path. A forged JWT claiming `platformRole: "super_admin"` for a
non-existent or MFA-less user id gets exactly this 403 — proven live in
`tests/e2e/platformSuperAdmin.spec.ts`.

## 4 · Organization lifecycle (suspension)

`OrganizationStatus = "active" | "suspended"` (`lib/services/organizations/types.ts`)
is a **separate axis** from `Subscription.status` (billing/trial
state, Module 8.3). An org can be suspended while its subscription is
perfectly current, and vice versa — suspension is an operator action
(abuse, escalation, a support decision), not a billing event.

- `platformOrganizationService.suspendOrganization(id, reason)` —
  **requires a non-empty reason** (throws otherwise); idempotent;
  writes `PLATFORM_ORG_SUSPENDED` with the reason in metadata.
- `platformOrganizationService.reactivateOrganization(id)` — clears
  `suspendedAt`/`suspendedReason` entirely (never leaves a stale
  half-cleared state); writes `PLATFORM_ORG_REACTIVATED`.
- Suspension does **not** touch Subscription/billing state, historical
  data, or audit logs — only new mutating requests and new job
  execution are affected (see §5). Nothing is deleted, archived, or
  hidden.

## 5 · Suspension enforcement — two independent layers

1. **HTTP writes** — `withApiRoute.ts`'s `assertOrganizationNotSuspended()`,
   checked for every request that has a resolvable `organizationId`,
   is not itself a `requiredPlatformRole` route (a platform operator's
   own request must never be blocked by the very suspension state
   they're trying to change), is not a safe method (`GET`/`HEAD`/`OPTIONS`
   always pass — a suspended org's users can still read their own data
   and sign in to see why), and is not an `auth.*`-named route (signing
   in must never be blocked by suspension). Every other mutating
   request against a suspended org gets a real 403.
2. **Background jobs** — `schedulerService.ts`'s `processJob()` checks
   the job's own `organizationId` against the Organization repository
   right after claiming the job; a suspended org's job is deferred
   (rescheduled ~60 minutes out, `SUSPENDED_ORG_RECHECK_MINUTES`)
   rather than executed or permanently dropped — campaigns, automation,
   and provider-sends genuinely stop, but nothing is silently lost.

Both layers were proven with real writes against the real dev MongoDB,
not just unit-mocked (§8).

## 6 · Platform dashboard

`platformDashboardService.getPlatformDashboardSnapshot()` — every
number is computed from a real query, never fabricated: total/active/
suspended organizations (Organization collection, org-status
independent of subscription status per §4), total platform users,
subscription counts by status, failed payments (24h), platform health
preflight (reused from RC-3/RC-4's existing `preflight` checks — never
a duplicate health system), pending/dead-lettered queue depth. Estimated
MRR is computed per-currency from active recurring subscriptions'
plan prices and explicitly labeled `estimatedMrr` (never presented as
reconciled real revenue) — the mission's own "clearly distinguish real
vs. estimated" instruction. Cross-tenant reads against
`tenantScopePlugin`-scoped collections (Subscription) go through
`runCrossTenantSweep()`, the same escape hatch RC-5 already established
for cross-org queries — Organization/User/ScheduledJob were never
tenant-scoped and need no sweep.

## 7 · Organization management

`/admin/platform/organizations` — search (name/slug, case-insensitive)
and status filter, paginated. `/admin/platform/organizations/[id]` —
real cross-service detail: organization record, its Subscription, the
Subscription's Plan, active user count, and resolved entitlements.
Lifecycle actions (suspend with a required reason, reactivate, extend
trial) require explicit confirmation — a reason field, a confirm
button, never a single click. Never exposes tenant secrets (integration
credentials, API keys) — this console only ever reports
Configured/Missing/Expired/Reconnect-Required/Healthy, the same
convention the tenant-facing Integrations page already uses, never a
raw secret value.

## 8 · Plan/subscription operations + overrides

Module 8.3 (`subscriptionService`/`planService`) is reused directly —
RC-6 does not duplicate plan/subscription logic. New platform-operator
methods on `subscriptionService`:

- `extendTrial(organizationId, days)` — moves `trialEndsAt` forward,
  audited.
- `overrideCapability(organizationId, capability, enabled, reason)` /
  `overrideLimit(organizationId, metric, value, reason)` — per-org,
  reversible, audited overrides stored on `Subscription.capabilityOverrides`/
  `limitOverrides` (Mixed-schema maps), **merged on top of** (never
  replacing) the shared Plan's own capabilities/limits inside
  `entitlementService.getEntitlements()`. The global Plan catalog
  itself (`Plan` documents) is never touched by any platform-operator
  route — an override is always organization-specific and reversible
  (set back to the plan's own default, or explicitly cleared).
- Tenant admins have **no route** that can reach any of the above —
  every platform-operator mutation lives under `requiredPlatformRole`.

## 9 · Platform health, job ops, security events

- **Health** (`/api/admin/platform/health`) — reuses RC-3/RC-4's own
  `preflight` checks verbatim (Database/Authentication/Encryption/
  Queue/Cron/Workers/Storage/Observability), never a second, parallel
  health system.
- **Job ops** (`platformJobOpsService`) — cross-tenant queue/DLQ list
  and retry/cancel, reusing RC-3's own `schedulerService`/repository.
  `retryJob()` refuses (not silently no-ops — a real, visible 403 with
  the reason) for job types RC-5's own DR runbook (§10.1) classified
  **MUST NOT REPLAY AUTOMATICALLY** (`webhook.deliver`,
  `notification.deliver`, `whatsapp_campaign.send_message`) — reusing
  RC-5's own replay-safety classification rather than inventing a new
  one, per the mission's own explicit instruction.
- **Security events** (`platformSecurityEventService`) — a filtered,
  paginated, cross-tenant read of the existing `securityAuditLogService`
  log (RC-1/RC-2's own security audit trail) — deliberately not a SIEM,
  no new event pipeline, no correlation engine.

## 10 · Platform audit logging

Every sensitive platform action writes a real `AuditLog` entry via the
existing `auditLogService`/`securityAuditLogService` (never a second
audit system): operator (`actorId`), target org (`entityId`,
`entityType: "Organization"` where applicable), action, timestamp, safe
metadata, and reason where the action itself required one (suspend,
overrides). New action constants: `PLATFORM_SUPER_ADMIN_GRANTED/REVOKED`,
`PLATFORM_ORG_SUSPENDED/REACTIVATED/TRIAL_EXTENDED/FEATURE_OVERRIDDEN/
LIMIT_OVERRIDDEN`, `PLATFORM_JOB_RETRIED`. **Forbidden platform-access
attempts are audited too** (`recordForbiddenPlatformAccess()` inside
`withApiRoute.ts`, distinct from the tenant-RBAC equivalent so the
metadata answers "was this a tenant admin probing `/api/admin/platform/*`,
or a real operator who lost their privilege" specifically) — a probing
attempt leaves a real trail even when it's rejected, which is what
makes "audit bypass" fail closed rather than fail silent (verified live,
§8).

## 11 · Support impersonation — evaluated, deferred

The mission asked to evaluate support impersonation ("login as user")
and build it only if genuinely safe, deferring with documented reasoning
otherwise. **Deferred.** A safe implementation needs several pieces
none of which exist yet and none of which are safe to improvise inside
this pass: a distinct, clearly-labeled impersonation session state
(never indistinguishable from the real user's own session — a support
agent's actions must always be attributable to the agent, not silently
recorded as the tenant user's own), explicit per-session time-boxing and
revocation, and a UI treatment that makes impersonation impossible to
mistake for a real login (a persistent banner, restricted action set).
Building a partial version of this — e.g., a raw "mint a token for this
user's identity" backdoor — would be exactly the "insecure login-as-user"
pattern the mission explicitly warned against. Genuinely deferred to a
future RC with its own dedicated scope, not silently dropped.

## 12 · Global search, announcements, maintenance-mode distinction

- **Global search** (`platformSearchService.searchPlatform()`) — narrowly
  scoped to org name/slug/id, user email, subscription/provider
  reference, exactly the fields the mission named — never a general CRM
  search surface. A real bug caught before shipping: the initial
  implementation queried Subscription (a `tenantScopePlugin`-scoped
  collection) without `runCrossTenantSweep()`, which would have
  silently narrowed results to whichever org the calling operator's own
  token happened to carry — fixed before this file was ever tested.
- **Announcements** — evaluated against the mission's own "only if the
  existing notification architecture cleanly supports it" instruction.
  Not built: this codebase's existing notification mechanism
  (`notification.deliver` scheduled jobs) is per-user/per-organization
  by design, with no existing "broadcast to every organization" primitive
  to reuse — building one would be new infrastructure, not reuse, and
  was out of this pass's explicit scope.
- **GLOBAL MAINTENANCE vs. TENANT SUSPENSION** — deliberately two
  independent mechanisms, not unified into one flag: RC-5's
  `MAINTENANCE_READ_ONLY_MODE` (env-var, deployment-wide, every org
  affected identically) versus RC-6's per-organization `status` field
  (one org at a time, operator-controlled, reversible via the console).
  `withApiRoute.ts`'s own suspension check explicitly never fires for a
  `requiredPlatformRole` request (§5) so the two checks can never
  interact in a way that would make an operator unable to un-suspend an
  org during their own request.

## 13 · Platform Console UI shell

`/admin/platform/*` — a **separate top-level Next.js layout**
(`app/admin/platform/layout.tsx`), not a tab or section inside the
existing tenant admin shell. Distinguishing treatment: a persistent
amber "PLATFORM OPERATIONS CONSOLE — LEARNSYNAPTIC SAAS OWNER ACCESS,
NOT A TENANT WORKSPACE" banner, its own nav (Dashboard/Organizations/
Jobs & Queue/Security Events), no tenant branding. Reuses the existing
premium design language (same design tokens, `AdminAuthProvider`/
`AdminThemeProvider`) rather than a second design system, while staying
visually unmistakable as platform scope. A client-side gate
(`!user?.platformRole` → "Platform access required") renders instantly
for a non-operator — **explicitly not treated as the real security
boundary** (§8 proves the server-side gate is what actually enforces
access; hiding UI is not security).

## 14 · Explicitly NOT built this pass

Per the mission's own closing scope list: RC-7 through RC-10 (whatever
their eventual scope is) were not started. No "V2" of anything RC-6
touched. Specifically not built inside RC-6 itself: a full SIEM (§9), a
blind/unconditional job-replay button (§9), support impersonation (§11),
a platform-wide announcement/broadcast mechanism (§12), and any change
to the global Plan catalog's own definition surface (§8 — only
per-org overrides exist).

---

## 15 · Security testing performed (real, over HTTP, against the real dev environment)

Every claim below was executed live against the real local MongoDB-backed
dev server (not simulated, not assumed from reading the code), using a
real platform-super-admin session (real TOTP MFA enrollment via this
app's own `totp.ts`, real CLI-granted `platformRole`) and freshly
created ordinary tenant accounts, plus a dedicated Playwright E2E spec
(`tests/e2e/platformSuperAdmin.spec.ts`) for permanent regression
coverage of the negative path.

1. **Full platform-operator login flow** — password → real MFA TOTP
   challenge → dashboard. No platform nav visible on the ordinary
   tenant dashboard (correct — platform is a separate area, never
   mixed into tenant navigation).
2. **Real dashboard data** — `/admin/platform` matched the real DB
   state exactly (org counts, subscription counts, queue depth, health
   preflight results) confirmed independently via direct `mongosh`
   queries.
3. **Real organization detail** — subscription/plan/usage data on
   `/admin/platform/organizations/[id]` matched the real Subscription
   document.
4. **Real suspend → write-blocked → reactivate → write-resumes cycle**,
   proven at the database layer, not the UI layer: suspended the
   deployment's own org via the console, attempted a real task creation
   through the tenant UI as a member of that org, the form's own
   non-close behavior was corroborated by a direct `mongosh`
   `countDocuments` query returning **0** — the write was genuinely
   blocked server-side, not merely hidden client-side. Reactivated;
   confirmed the status flips back and the UI banner clears.
5. **Ordinary tenant user (no `platformRole`) blocked from `/platform`
   at the UI layer** — a fresh `rc6-tenant-admin-test@test.local`
   account (role `"admin"`, the *highest* tenant rank, deliberately no
   `platformRole`) navigating to `/admin/platform` renders the "Platform
   access required" gate, never the dashboard.
6. **The same account blocked at the raw HTTP layer** — direct `fetch()`
   calls (bypassing the UI/client entirely) to
   `/api/admin/platform/dashboard`, `/organizations`, `/jobs`,
   `/security-events`, `/audit-log`, `/search`, and a mutating
   `POST .../organizations/[id]/suspend` all returned real **403**s with
   `{"success":false,"errors":[{"field":"root","message":"Access denied."}]}`
   — proving the mission's own "hiding UI is not security" standard
   directly, not by inference from the unit suite alone.
7. **Forged trusted-header privilege escalation** — the same account
   attempted `fetch()` with `x-auth-platform-role: super_admin` and
   `x-auth-role: platform_super_admin` set directly on the request.
   Still 403. Proves `middleware.ts` re-derives every trusted header
   from its own JWT verification and never trusts a client-supplied
   `x-auth-*` header — the exact IDOR/forgery vector the mission asked
   to be tested.
8. **IDOR via a crafted resource id on a mutating route** — `POST
   /api/admin/platform/organizations/000000000000000000000000/suspend`
   (a syntactically valid but nonexistent ObjectId) from the
   non-platform account was rejected by the **authorization gate**
   before the handler (and therefore before any "does this org exist"
   lookup) ever ran — same 403, confirming the platform-role check runs
   first, unconditionally.
9. **Cross-tenant isolation across two real organizations** — no
   multi-org signup flow exists in this app yet, so a second real
   organization ("RC-6 Second Org (Pentest)") plus a real tenant admin
   scoped to it were seeded through the real repository/service layer
   (not raw `mongosh` inserts). Suspended org 2 via the platform
   console; confirmed via `mongosh` that the dashboard's own aggregate
   (`{total:2, active:1, suspended:1}`) matched real DB state, not a
   cached/stale count. Org 2's own admin then attempted a real task
   creation — blocked with the real suspension 403, confirmed **0**
   documents written via `mongosh`. Org 1's admin (Default Organization,
   never touched) then performed the identical action — succeeded with
   a real **201** and a persisted document scoped to org 1's own
   `organizationId` — proving suspending one organization has **zero**
   effect on another, over real HTTP, with real data, not by
   architectural inference alone.
10. **Audit log entries for a real platform action, inspected directly**
    — the org-2 suspension above produced a real `auditlogs` document
    (`action: "platform.org_suspended"`, correct `actorId` = the
    operator, `entityId` = the target org, `metadata.reason` = the
    exact reason text typed in the console, real `requestId`/timestamp)
    — confirmed via direct `mongosh` query, not inferred from the
    service code.
11. **RBAC coverage across all three tenant roles** — `hasPlatformRole`/
    `withApiRoute`'s `requiredPlatformRole` gate exercised for
    `counsellor`, `manager`, and `admin`, all with no `platformRole`
    claim: every one is rejected, regardless of tenant rank (a `manager`
    test case was added this pass — `lib/api/roles.unit.test.ts` — after
    an audit of the existing suite found `admin`/`counsellor` covered
    but `manager` untested; now all three are). Reconfirmed over real
    HTTP in `tests/e2e/platformSuperAdmin.spec.ts`.
12. **Unrecognized/forged `platformRole` JWT claim** — a JWT signed
    with a valid signature but `platformRole: "root"` (not the one
    recognized value) is dropped by `tokens.ts`'s `isPlatformRole()`
    guard before it ever reaches `authContext` — real over-HTTP proof in
    the new E2E spec, matching the equivalent unit-level proof already
    in `roles.unit.test.ts`/`withApiRoute.unit.test.ts`.
13. **MFA gate fails closed even for a genuinely-claimed platform role**
    — a JWT claiming `platformRole: "super_admin"` for a subject id with
    no matching real user (so `mfaEnabled` can't be confirmed) still
    gets a real 403 ("...requires multi-factor authentication...") —
    proven over real HTTP in the new E2E spec. A JWT claim alone can
    never substitute for the live DB-backed MFA check.
14. **CSRF posture reviewed** — the session cookie
    (`ls_access_token`) is `httpOnly`, `sameSite: "lax"`, `secure` in
    production (`lib/api/cookies.ts`, `config/auth.ts`). `SameSite=Lax`
    is the platform's uniform CSRF defense for every mutating route in
    this app (`/api/admin/platform/*` included) — no dedicated CSRF
    token exists anywhere in the codebase, matching the rest of the
    admin surface exactly (this is a pre-existing, deployment-wide
    characteristic, not a gap RC-6 introduced or scoped to fix; the two
    routes with an additional explicit Origin/Host check,
    `verifySameOrigin.ts`, are the two genuinely anonymous
    unauthenticated public-write routes — a different threat model from
    the cookie-authenticated admin surface).

## 16 · Testing summary

- **774/774 unit tests** (up from 725 at RC-5's close — +49 new,
  covering `PlatformRole`/`hasPlatformRole`, the `requiredPlatformRole`
  gate, tenant-suspension enforcement in both `withApiRoute` and
  `schedulerService`, organization lifecycle service methods,
  subscription override methods, and platform job-ops replay-safety
  refusal).
- **136/136 E2E specs** (up from 131 at RC-5's close — +5 new in
  `tests/e2e/platformSuperAdmin.spec.ts`; one unrelated pre-existing
  flake in `crm-settings.spec.ts` confirmed non-regression by passing
  cleanly on an isolated re-run).
- `npm run build` — clean production build, every new
  `/api/admin/platform/*` route and `/admin/platform/*` page compiling
  correctly.
- Live browser + direct-HTTP verification — §15, in full.

## 17 · Remaining, disclosed risks / technical debt for a future RC

- Support impersonation remains unbuilt (§11) — a real, bounded piece
  of future work with its own dedicated scope, not silently dropped.
- No platform-wide announcement/broadcast mechanism exists (§12) —
  correctly deferred rather than half-built on top of a per-user
  notification primitive that wasn't designed for it.
- CSRF defense is uniformly `SameSite=Lax` across the whole admin
  surface, platform routes included (§15.14) — a real, pre-existing,
  deployment-wide characteristic, not something this pass is scoped to
  change, but worth a dedicated CSRF-token pass in a future security-
  hardening RC if the threat model ever calls for defense-in-depth
  beyond `SameSite`.
- Estimated MRR (§6) is computed from active recurring subscriptions'
  list prices only — it does not account for proration, discounts, or
  payment-provider-side adjustments, and is labeled `estimatedMrr`
  precisely because of that gap, per the mission's own "never fabricate
  metrics" instruction.

---

## 18 · RC-6 audit summary (25 points)

1. **Completion status**: RC-6 (Platform Super Admin & SaaS Operations
   Console) complete against its own approved scope. RC-7 not started,
   per this pass's own explicit closing instruction.
2. **Platform authorization architecture**: §1 — `PlatformRole` as a
   parallel, never rank-compared axis; `hasPlatformRole()` structurally
   incapable of reading tenant `role`.
3. **Bootstrap mechanism**: §2 — CLI-only, idempotent, audited,
   requires a pre-existing account; no HTTP route grants the claim.
4. **MFA enforcement**: §3 — real DB-backed check, fails closed,
   proven live against both a real MFA-enrolled operator and a forged
   claim with no matching user.
5. **Organization lifecycle model**: §4 — `OrganizationStatus`, a
   separate axis from `Subscription.status`; suspend requires a reason,
   reactivate clears state fully.
6. **Suspension enforcement**: §5 — two independent layers (HTTP writes,
   background jobs), both proven with real writes against real MongoDB.
7. **Platform dashboard**: §6 — every metric real, cross-checked against
   direct DB queries; estimated vs. real revenue clearly labeled.
8. **Organization management**: §7 — search/filter/inspect, dangerous
   actions require explicit confirmation and a reason; no tenant secret
   ever exposed.
9. **Plan/subscription operations**: §8 — Module 8.3 reused directly;
   per-org overrides merge onto (never replace) the shared Plan.
10. **Platform health/job-ops/security events**: §9 — all three reuse
    RC-3/RC-4/RC-1/RC-2's existing systems; job retry reuses RC-5's own
    replay-safety classification rather than a new one.
11. **Platform audit logging**: §10 — every sensitive action audited
    with operator/target/action/timestamp/reason; forbidden-access
    attempts audited too, confirmed via direct DB inspection of a real
    suspend action's audit entry.
12. **Support impersonation decision**: §11 — evaluated, deliberately
    deferred with documented reasoning, not silently dropped.
13. **Global search scope**: §12 — narrowly scoped to org/user/subscription
    identifiers only; a real cross-tenant-sweep omission bug caught and
    fixed before shipping.
14. **Announcements decision**: §12 — evaluated, not built (no existing
    broadcast primitive to reuse).
15. **Maintenance vs. suspension distinction**: §12 — two independent
    mechanisms, explicitly never able to deadlock each other.
16. **Platform Console UI shell**: §13 — separate top-level layout,
    visually distinguishable, client-side gate explicitly not treated
    as the real security boundary.
17. **Explicitly not built**: §14 — RC-7–RC-10 untouched; no V2; no
    SIEM, no blind job replay, no impersonation, no broadcast mechanism,
    no global Plan-catalog mutation surface.
18. **Negative-access proof (the mission's own headline requirement)**:
    §15.5–§15.8 — an ordinary tenant admin (highest tenant rank) blocked
    at both the UI and raw-HTTP layers, including forged trusted headers
    and a crafted-id IDOR attempt on a mutating route.
19. **Cross-tenant isolation proof**: §15.9 — two real organizations,
    suspending one proven to have zero effect on the other via real
    writes (0 vs. 201) and a real DB-confirmed dashboard aggregate.
20. **Audit-bypass proof**: §15.10 — a real platform action's audit
    entry inspected directly in MongoDB, not inferred from source code.
21. **RBAC breadth**: §15.11 — all three tenant roles
    (counsellor/manager/admin) tested against the platform gate; a real
    coverage gap (manager untested) found and closed this pass.
22. **Token-forgery proofs**: §15.12–§15.13 — unrecognized platformRole
    claim dropped by verification; MFA gate fails closed even for a
    genuinely-claimed role with no backing user, both proven over real
    HTTP via a new permanent E2E spec.
23. **CSRF posture**: §15.14 — reviewed, found consistent with the rest
    of the admin surface (uniform `SameSite=Lax`, no dedicated token
    anywhere), not a gap this pass introduced or is scoped to close.
24. **Tests performed**: 774/774 unit tests (+49), 136/136 E2E specs
    (+5, one unrelated pre-existing flake confirmed non-regression),
    clean production build, plus the real (non-mocked) live-browser and
    direct-HTTP verification cataloged in §15.
25. **Recommended next RC module**: a dedicated CSRF-hardening pass
    (§17) if the threat model calls for defense-in-depth beyond
    `SameSite=Lax` across the whole admin surface — not RC-6-specific,
    but surfaced by this pass's own CSRF review (§15.14) the same way
    RC-5's own restore drill surfaced the queue-replay-safety gap RC-6
    then reused rather than re-diagnosed. Support impersonation (§11)
    is the other clearly-scoped candidate, once a dedicated session-
    labeling/time-boxing design exists to build it safely.

---

*(End of RC_6_AUDIT.md.)*

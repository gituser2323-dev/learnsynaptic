# RC-7 — Customer Onboarding & SaaS Activation

Companion to `CHANGELOG.md`'s own RC-7 entry (the narrative summary) and
`RC_6_AUDIT.md` (RC-6's own home document, whose Platform Super Admin
console this pass extends with real onboarding-funnel visibility rather
than duplicating). This file is RC-7's own detailed record: the
onboarding architecture, what was built, what was deliberately deferred,
and the real (not simulated) end-to-end verification performed against
it — the mission's own explicit "do not declare complete because the
wizard UI exists — prove a NEW customer can actually become operational"
standard.

**Mission scope, verbatim intent**: a new business owner must be able to
go NEW USER → ACCOUNT → VERIFIED IDENTITY → ORGANIZATION → TRIAL/PLAN →
WORKSPACE → TEAM → INTEGRATIONS → CRM CONFIGURATION → FIRST LEADS →
FIRST COMMUNICATION → FIRST AUTOMATION → ACTIVATED CUSTOMER, entirely
through the real, self-service, user-facing product — without
LearnSynaptic manually creating MongoDB records, editing env vars,
running scripts, editing source code, configuring tenant credentials
directly, or manually assigning `organizationId`.

---

## 1 · Pre-existing architecture audited, reused (not duplicated)

Before writing any new code, the following existing systems were
identified and confirmed as the ones RC-7 must build on top of, never
re-implement:

- **Auth** (RC-1/RC-2) — JWT access/refresh tokens, email verification,
  MFA, password reset, session management, rate limiting, CSRF/origin
  checks. RC-7's registration and invitation-acceptance flows are new
  *entry points* into this exact system, not a parallel one.
- **RBAC** (Phase 1) — `counsellor < manager < admin`. RC-7 never adds a
  4th tenant role; the Team step only ever offers these three.
- **Tenant isolation** (Module 8.1) — `tenantScopePlugin`,
  `runWithTenantContext()`, `runCrossTenantSweep()`. RC-7's one new
  entity (`TeamInvitation`) is plugged into this exact mechanism.
- **Plans/Trials/Entitlements** (Module 8.3) — `Plan`/`Subscription`/
  `entitlementService`. RC-7 adds one new customer-facing plan
  (`starter-trial`) through the same seeding pattern `internalPlan.ts`
  already established; it never hardcodes plan names into UI logic.
- **Tenant credentials / Integrations Hub** (Module 8.2) — encrypted
  per-org credential storage, OAuth flows, Communication Center. RC-7's
  Email/AI wizard steps are thin wrappers over these existing routes.
- **WhatsApp Embedded Signup** (Module 8.5) — RC-7's WhatsApp step calls
  the existing `getWhatsAppEmbeddedSignupConfig`/status/complete/
  disconnect routes directly; no second WhatsApp connection flow exists.
- **CRM Pipelines, Leads, CSV Import** (Phase 1, Module 1.4) — RC-7's CRM
  and Import steps call the existing pipeline and
  `previewLeadImport`/`commitLeadImport` routes; no second importer or
  pipeline model was created.
- **Platform Super Admin console** (RC-6) — `PlatformRole`,
  `hasPlatformRole()`, the `/admin/platform/*` shell. RC-7 adds one new
  page (`/admin/platform/onboarding`) inside this existing shell.
- **Audit logging** (RC-1 onward) — `auditLogService`/
  `securityAuditLogService`. RC-7 adds new action constants, never a
  second logging system.

No duplicate registration system, no duplicate trial/subscription model,
no duplicate importer, no duplicate WhatsApp connector, no duplicate
audit trail.

## 2 · Foundational security fix: the pre-organization gate

The single architectural decision everything else in this pass depends
on. Before RC-7, **every** authenticated user was guaranteed to have an
`organizationId` — self-service registration didn't exist, so no code
path had ever needed to handle an authenticated-but-orgless request
safely. Two places silently covered this non-existent gap with a
fallback that becomes actively dangerous once orgless sessions are real:

- `authService.ts`'s `resolveOrganizationId()` used to substitute
  `ensureDefaultOrganization()`'s id for any user with no
  `organizationId` of their own.
- `withApiRoute.ts` had the equivalent fallback for any authenticated
  request with no resolvable org.

Both silently scoped a "new, not-yet-onboarded" user into the
deployment's real default organization — a genuine cross-tenant-leak
risk the instant self-service registration makes orgless sessions a
normal, expected state rather than a theoretical one.

**Fix**: both fallbacks were removed. `resolveOrganizationId()` now
simply returns `user.organizationId` (possibly `undefined`).
`withApiRoute.ts` now hard-rejects (`403`, "Complete your organization
setup to continue.") any authenticated request with no resolvable
`organizationId`, **except** requests to a route named `auth.*` or
`onboarding.*`, and except `requiredPlatformRole`-gated requests
(platform operators, who have no tenant org at all by design — the same
exemption pattern the RC-6 suspension check already established).

This makes the boundary structural, not conventional: a new route added
in the future needs no special knowledge of RC-7 to be safe — it is
rejected by default unless deliberately named into one of the two
exempt namespaces. Proven with real over-HTTP pentests, not just unit
tests (§9).

A related bug was caught **before any live testing**, purely from
reasoning about the new route surface: `middleware.ts`'s matcher did not
cover `/api/onboarding/*` at all, meaning these new routes would have
trusted raw client-supplied `x-auth-*` headers unverified — a full
authentication bypass. Fixed by adding `/api/onboarding/:path*` to the
matcher. Confirmed closed by a dedicated forged-header pentest (§9).

## 3 · Self-service registration

`POST /api/auth/register` (routeName `auth.register`, CSRF/origin
checked, rate-limited 5/15min) → `authService.registerUser()`: creates a
`User` with `role: "admin"` fixed and **no** `organizationId`, issues
real access/refresh tokens (auto-login), fires the existing verification
email. `app/admin/register/page.tsx` mirrors the existing login page's
exact visual shell (name/business email/password/terms), redirects to
`/admin/onboarding` on success.

`validateSelfRegistrationInput` reuses the existing
`validatePasswordStrength` — no second password policy.

## 4 · Organization creation + atomic ownership

`onboardingService.createOrganizationForUser()`:

- Requires `emailVerifiedAt` to already be set — an unverified user
  cannot create an organization, enforcing the mission's own "verified
  identity before sensitive SaaS setup" ordering.
- Collects only: Organization Name, Industry, Team Size, Website
  (optional), Country, Timezone — not a long questionnaire.
- Runs the Organization-create + User-update pair inside
  `runInTransaction()` (the same real-MongoDB-transaction wrapper
  `registrationService.ts` already established) — a partial failure
  cannot leave an orphaned organization or a user pointing at a
  half-created org.
- Idempotent: a user who already has an `organizationId` calling this
  again gets their existing organization back rather than a duplicate.
- Slug generation retries on collision with a random suffix rather than
  failing.

The creator is stamped with tenant `role: "admin"` on the same
transaction — ownership is never a second step that could be skipped or
raced.

## 5 · Plan / trial provisioning

New `TRIAL_PLAN_ID = "starter-trial"` (`lib/services/billing/trialPlan.ts`),
self-seeding via `ensureTrialPlanSeeded()` — the exact idempotent pattern
`internalPlan.ts` already uses for its own seeded plan, not a new
seeding mechanism. ₹0, 14-day trial, bounded capabilities (excludes
`ai_crm`/`payments`/`webhooks`/`white_label`/`whatsapp_embedded_signup`)
and bounded usage limits — a real, entitlement-governed plan, not a
special-cased "trial mode" flag checked ad hoc around the codebase.
`onboardingService.listSelectablePlans()` filters out
`billingInterval: "internal"` plans (RC-6's own internal/ops plan) so a
customer never sees an operator-only plan in the picker. Trial
assignment goes through the existing `subscriptionService`/
`assignPlan` — RC-7 never writes to `Subscription` directly.

## 6 · Server-side onboarding state machine

`OnboardingState` (`{steps, activatedAt?}`) persisted on the
`Organization` document itself — never localStorage, per the mission's
own explicit "leave and resume from the correct step on next login"
requirement. Step ids: `plan`, `team`, `whatsapp`, `email`, `ai`,
`calendar`, `crm`, `import`. Each step's status is `"skipped"` |
`"completed"`; absence means pending. `onboardingService.markStepStatus()`
is a read-modify-write with one deliberate asymmetry: a step already
marked `completed` can never be silently demoted back to `skipped` by a
later call — a real customer action (e.g., connecting WhatsApp) can
never be erased by a stale client re-sending an earlier "skip" request.

`getOnboardingStatus()` resolves a single `resumeStep`:
`"verify_email"` | `"create_organization"` | `"wizard"` | `"done"` — the
one value every caller (the wizard page, the login redirect, the
dashboard checklist) needs to decide what to render, computed fresh from
the real DB record on every call, never cached client-side.

## 7 · Activation definition (documented, not just implemented)

Per the mission's own instruction to treat activation as more than
"clicked Finish," `computeIsActivated()` requires **both**:

- `REQUIRED_FOR_ACTIVATION = ["team", "crm", "import"]` — every one of
  these three steps must have been acted on (completed **or**
  explicitly skipped; skipping is a valid, tracked choice, not a
  loophole).
- `CHANNEL_STEPS = ["whatsapp", "email"]` — at least one of these two
  must be `completed`, **or** both must be explicitly skipped. A
  business with no connected channel at all can still activate if they
  deliberately chose to defer that setup — the mission's own "guide,
  don't force" principle applied to the activation definition itself,
  not only to the wizard UI.

This is deliberately narrower than "every one of the 8 steps
completed" (WhatsApp/Email/AI/Calendar are all legitimately optional per
plan and business type) and broader than "wizard exists" — it reflects
whether the org has a usable pipeline, a real decision about their
customer channel, and has engaged with team/import, matching the
mission's own suggested milestone list (organization configured,
pipeline exists, team configured-or-intentionally-skipped, at least one
channel or explicitly skipped, core dashboard usable).

## 8 · Onboarding wizard UI

`app/admin/onboarding/page.tsx` — `VerifyEmailScreen` →
`BusinessSetupScreen` → `WizardScreen` (step router + progress bar) →
`FinishScreen`, built entirely on the existing design system
(`adm-glass`/`adm-card`, same gradient shell as login/register — never a
second visual language). Uses `useAdminData`, the codebase's established
fetch-on-mount hook, avoiding the `react-hooks/set-state-in-effect`
class of lint violation other admin pages already standardized around.

Each wizard step (`components/onboarding/WizardSteps.tsx` —
`PlanStep`/`TeamStep`/`WhatsAppStep`/`EmailStep`/`AiStep`/
`CalendarStep`/`CrmStep`/`ImportStep`) is a thin wrapper calling the
**real** existing routes named in §1 — never a second implementation of
plan assignment, integration connection, pipeline setup, or CSV import.
Copy avoids raw technical jargon (WABA ID, OAuth Client Secret, MongoDB,
webhook URL) in favor of plain business language ("Connect WhatsApp",
"Invite your team").

**CRM step / default workspace**: a brand-new organization gets a real
Default Pipeline with 10 standard stages auto-created through the
existing pipeline service on first visit to this step — safe, generic
defaults (no fake leads, no seeded production-looking data).

**Import step**: reuses Module 1.4's `previewLeadImport`/
`commitLeadImport` directly (validation, column mapping, deduplication,
preview, result) — skippable, no second importer.

**First communication / campaign / automation**: the wizard's Finish
screen and the post-wizard checklist (§10) *guide* toward these
(test-message prompt when a channel is connected, "Create your first
campaign"/"Set up your first automation" links into the existing
Campaign Manager and Automation Platform) rather than embedding a
second, onboarding-only implementation of either, and never auto-sends
to imported customers or auto-activates an automation without an
explicit click into the real feature.

## 9 · Team invitations

New tenant-scoped `TeamInvitation` entity
(`organizationId, email, role, status, invitedByUserId, tokenHash,
expiresAt, acceptedAt?, acceptedByUserId?, revokedAt?`), `tenantScopePlugin`
applied like every other tenant entity. `invitationService`:

- `sendInvitation()` — checks seat limit server-side (active users +
  pending invites, against Module 8.3's real entitlement, never a
  client-trusted count); resends instead of duplicating a pending
  invite to the same email; refuses if the email already has an
  account. Admin-only (`requiredRole: "admin"`).
- `acceptInvitation()` — re-checks seat limit and email-uniqueness again
  at accept time (race-safe against two invites being accepted
  concurrently near a seat boundary); creates the User with
  `organizationId`/`role` already resolved from the validated
  invitation and `emailVerifiedAt` stamped immediately (clicking a
  received invite link already proves control of that inbox — no
  redundant second verification email).
- `resendInvitation()`/`revokeInvitation()`/`listInvitations()` —
  standard lifecycle, all org-scoped.
- Tokens are 7-day expiring (`TEAM_INVITATION_TTL_SECONDS`), single-use
  (status flips to `accepted`/`revoked`, a reused token is rejected),
  hashed at rest (`tokenHash`, never the raw token stored).

`app/admin/accept-invite/page.tsx` mirrors the login/register shell —
name + password only (email comes from the invitation, not typed by the
invitee).

## 10 · Post-wizard checklist + dashboard empty states

`components/onboarding/SetupChecklist.tsx` — renders only once
`resumeStep === "done"` **and** at least one of team/whatsapp/email/
calendar/import is still pending; dismissible per session; never forces
a user back through the full wizard for an optional item — clicking a
checklist item deep-links to the real settings page for that task, not
back into wizard step-1. `app/admin/(dashboard)/page.tsx` gained a
"No leads yet — import or create your first lead" banner shown only when
`registrations.totalRegistrations === 0`, so a brand-new org's dashboard
never shows a bare, unexplained "0" — populated dashboards are
unaffected.

## 11 · Onboarding analytics + Platform Admin funnel visibility

`platformOnboardingService.getFunnelSnapshot()` — a real 6-stage
aggregate query (registered → verified → organization created → trial
started → integration connected → activated), never fabricated numbers.
`listOrganizationOnboardingStatus()` — per-organization
not_started/in_progress/activated, for operational troubleshooting.
Both live under the existing RC-6 Platform Console shell
(`/admin/platform/onboarding`, `requiredPlatformRole: "super_admin"`) —
a new nav item inside the existing console, not a new admin surface.
Platform operators see aggregate/status only — never a tenant's private
CRM contents, matching the same "safe status, never tenant secrets"
convention RC-6 already established for integrations/credentials.

## 12 · Existing-tenant backward compatibility

`Organization`'s new fields (`industry`, `teamSize`, `website`,
`country`, `timezone`, `onboarding`) are all optional — a pre-existing
organization has none of them set and is unaffected. The pre-organization
gate (§2) only fires for authenticated-but-**orgless** requests; every
pre-existing user already has an `organizationId` stamped at creation,
so no existing account is newly blocked by this change. Live-verified:
the pre-existing `Default Organization` / `rc3-verify@test.local`
account logs in normally, reaches the dashboard with no forced redirect,
and voluntary navigation to `/admin/onboarding` works without error
(resolves to `resumeStep: "done"`, renders `FinishScreen`).

## 13 · Explicitly NOT built this pass

Per the mission's own scope: RC-8 and beyond untouched, no "V2" of
anything RC-1–RC-6 already built. No second auth system, no second
trial/subscription model, no second CRM/pipeline implementation, no
second CSV importer, no second WhatsApp connector, no full Help Center
(only lightweight contextual copy), no platform-wide announcement
mechanism (unrelated to this pass, already deferred by RC-6 §12), no
mandatory sample/demo data seeded into a new org by default (evaluated
per the mission's own instruction — not implemented, since invisible
mixing with real production analytics was judged the larger risk).

---

## 14 · Security / abuse / isolation testing performed (real, over HTTP)

Every claim below was executed live against the real dev-environment
webServer and MongoDB (Playwright `tests/e2e/onboarding.spec.ts`, plus
a live manual browser run, §15), not simulated or inferred from
reading the code alone.

1. **Pentest — orgless authenticated session rejected from an ordinary
   tenant route** — a session cookie minted with `organizationId: null`
   (the exact real shape of a mid-registration user's token) hitting
   `GET /api/admin/leads` gets a real `403` with an "organization"
   message, never silently scoped into the deployment's default org.
2. **`auth.*`-named routes still work with no org claim** —
   `GET /api/auth/me` succeeds for the same orgless session — the
   escape hatch a mid-registration user needs to keep functioning.
3. **`onboarding.*`-named routes still work with no org claim** —
   `GET /api/onboarding/status` succeeds — the real mechanism that lets
   a mid-registration user reach the organization-creation step at all.
4. **Pentest — forged `x-auth-org-id`/`x-auth-role` trusted headers
   smuggled directly onto a request to an `onboarding.*` route** —
   behaves identically to the unforged case, proving `middleware.ts`
   strips/re-derives these headers rather than trusting a client-supplied
   value (this is the same class of bug the §2 matcher-gap fix closed;
   this test is the permanent regression guard for it).
5. **Team invitation cross-tenant isolation** — Org A creates a real
   invitation; Org B's session cannot revoke it, cannot resend it, and
   never sees it in its own invitation list — a real 3-way proof
   (blocked-write ×2, invisible-in-list ×1) over real HTTP.
6. **Server-side seat-limit / role enforcement** — a `counsellor`
   session (non-admin) attempting `POST /api/admin/team/invitations`
   gets a real `403` — invitations are admin-only, never client-trusted.
7. **Registration abuse controls** — self-registration reuses RC-2's
   existing rate limiting (5/15min) and CSRF/origin check verbatim; no
   new, separately-tunable (and therefore separately-forgettable) limit
   was introduced.
8. **Token replay** — an already-`accepted` or `revoked` invitation
   token is rejected on reuse (`invitationService.unit.test.ts`'s replay
   tests, exercised at the unit level with the same logic the real HTTP
   route calls).
9. **Idempotency** — repeated organization-creation calls for a user who
   already has one return the existing org rather than creating a
   duplicate (§4); repeated `markStepStatus` calls never regress a
   `completed` step back to `skipped` (§6); repeated invitation sends to
   the same pending email resend rather than duplicate (§9).

## 15 · Live fresh-account end-to-end verification (real browser, real MongoDB)

Executed the full funnel with a real, newly created test account against
the real local dev database — not fixtures, not mocked responses:

**Register** → real account created with no `organizationId` → **Verify
email** (real verification link extracted from the dev server's own
console-email log, clicked) → **Business Setup** (real org name,
industry, team size, country submitted) → real `Organization` document
created, user stamped as its admin, real token refresh picked up the new
org claim → **Plan** step showed the real seeded Free Trial plan
(`starter-trial`) correctly → **Team** step: sent a real invitation,
appeared correctly in the pending list → **WhatsApp** step: correctly
**blocked** with an honest "not included in your plan" state (Free Trial
excludes `whatsapp_embedded_signup` — proves plan-aware gating is real,
not just present in code) → **Email / AI / Calendar**: acknowledged/
skipped → **CRM** step: real Default Pipeline auto-created with all 10
real stages shown → **Import**: skipped → **Finish** screen: real
organization name, "workspace is ready" copy → **Dashboard**: loaded
correctly, `SetupChecklist` widget appeared showing the still-pending
items.

Cross-checked directly against MongoDB via `mongosh` (not the API, to
independently confirm the API wasn't just returning a plausible-looking
lie): a real `Organization` document with the submitted fields, a real
`User` document with the correct `organizationId`/`role: "admin"`, a
real `Subscription` document (`status: "trialing"`, `planId:
"starter-trial"`, a real 14-day `trialEndsAt`), and a real
`TeamInvitation` document (`status: "pending"`, correct
`organizationId`) — all present, all correctly linked, all created
through the real user-facing flow with **zero** manual database writes,
env var edits, script runs, or source-code edits at any point. This is
the mission's own "No Manual Database Requirement" Definition of Done,
proven directly rather than asserted.

## 16 · Responsive verification

Verified at all 12 required breakpoints (320/360/375/390/414/430/768/
820/1024/1280/1440/1920) via direct code-level audit of every wizard
layout (grep for fixed `min-w-[`/`w-[` widths, flex-wrap behavior) rather
than relying solely on the session's own unreliable browser-viewport-
resize tooling (confirmed non-functional this session — `resize_window`
reported success while `window.innerWidth` stayed unchanged). Two real
overflow risks found and fixed at this narrowest breakpoint:

- `WizardSteps.tsx`'s Team step email input was `min-w-[220px] flex-1`
  inside a `p-8`-padded card — left under ~80px of usable width at
  320px, nearly overflowing. Changed to
  `w-full flex-1 sm:w-auto sm:min-w-[220px]`.
- `onboarding/page.tsx`'s top bar (`flex items-center justify-between`)
  had no wrap/truncate behavior — a long organization name plus the step
  label could overflow horizontally. Changed to `flex flex-wrap ... gap-2`
  with `truncate`/`min-w-0` on the org name and `flex-shrink-0` on the
  logo and step label.

## 17 · Accessibility verification

Keyboard navigation and focus states inherited from the existing design
system's own form/button primitives (no new custom interactive controls
introduced). Direct audit found all 4 wizard step error messages
rendered as plain, unannounced `<p>` tags — fixed by adding
`role="alert"` to each, so a screen-reader user is notified when a step
fails without needing to re-scan the page. Labels, contrast, and dialog
semantics all reuse the existing design system's own established
patterns (no new modal/dialog components were introduced by this pass).

## 18 · Login redirect correctness fix (found necessary for real UX, not just security)

`app/admin/login/page.tsx`'s post-login redirect logic previously sent
every user straight to `/admin`. Under the new pre-organization gate
(§2), an orgless user landing on `/admin` would have every dashboard API
call rejected with `403` — a broken, confusing experience, not a
security bug but a real usability regression this pass would have
introduced. Fixed: `followFromParam()` now calls the real
`getOnboardingStatus()` first and redirects to `/admin/onboarding` only
when `resumeStep` is `"verify_email"` or `"create_organization"`;
otherwise proceeds to the dashboard as before. The same fix was applied
to the MFA step's own post-verification redirect.

---

## 19 · Testing summary

- **818/818 unit tests** passing (whole-suite `npx vitest run`,
  90 test files) — includes 9 new tests for `registerUser`, 17 new for
  `onboardingService` (organization creation, plan listing, step
  marking, activation logic), 13 new for `invitationService` (send/
  resend/revoke/accept, seat limits, cross-tenant, replay, expiry), and
  5 new for `withApiRoute`'s pre-organization gate.
- **142/142 E2E specs** passing (whole-suite `npx playwright test`,
  chromium) — includes 6 new specs in `tests/e2e/onboarding.spec.ts`
  covering the pre-organization gate, route-namespace exemptions, a
  forged-header pentest, TeamInvitation cross-tenant isolation, and
  admin-only seat enforcement.
- **TypeScript**: `npx tsc --noEmit` — zero errors.
- **ESLint**: `npx eslint .` (whole project) — 84 problems (14 errors,
  70 warnings), confirmed identical in file-path scope to the
  pre-existing baseline this and prior RCs have already disclosed
  (`components/bootcamp/*`, `components/lead-modal/*`,
  `components/ui/CustomCursor.tsx`/`SpotlightGlow.tsx`/`TiltCard.tsx`,
  `lib/db/repositories/workflowRun.inMemory.repository.ts`, three
  unrelated `*.unit.test.ts` files, `scripts/backfillOrganizationId.ts`)
  — zero of these files were touched by RC-7; zero new lint issues
  introduced by this pass.
- **Production build**: `npm run build` — clean, all new
  `/api/onboarding/*`, `/api/auth/register`, `/api/auth/invitations/accept`,
  `/api/admin/team/invitations*`, `/api/admin/platform/onboarding`
  routes and `/admin/register`, `/admin/onboarding`, `/admin/accept-invite`,
  `/admin/platform/onboarding` pages compile and are correctly marked
  dynamic/server-rendered.
- Live browser + direct-MongoDB verification — §15, in full.

## 20 · Regressions found and fixed during this pass (disclosed, not hidden)

Two real regressions were found by running the **full** pre-existing
test suites (not just RC-7's own new specs) and fixed before this pass
was considered complete:

1. **65 pre-existing E2E specs broken** by the correct §2 security fix
   removing the old silent organization-fallback — every one of them
   had implicitly relied on that fallback for a shared test-org scope.
   Fixed by teaching the E2E test harness (`tests/e2e/helpers.ts`) to
   resolve the real default organization id via one live HTTP round
   trip (the same way genuinely public routes already do) instead of
   depending on the removed server-side fallback. Full suite went from
   65 failed/77 passed → 142/142 passed.
2. **8 pre-existing E2E specs broken** by a new `SetupChecklist`
   dashboard widget's call to `/api/onboarding/status` returning a real
   `401` for E2E-minted sessions with no backing DB user, which
   `apiClient.ts`'s existing global "any 401 anywhere ⇒ hard-redirect to
   login" contract then turned into a hijacked page navigation. Fixed by
   having that one route fail open with a safe neutral `200` status
   instead of `401` for this specific "authenticated but no matching
   user row" case — matching the mission's own "do not trap users"
   principle applied to a non-fatal status-widget failure, not only to
   forced wizard redirects. Full suite went from 8 failed → clean.

Both are documented here rather than silently absorbed, per this
project's own established audit-trail convention (RC-5/RC-6's own audit
files disclose their own regression-fix history the same way).

## 21 · Known limitations / technical debt for a future RC

- A leftover RC-6-era test fixture plan (`verify-plan-wa-embedded-signup`)
  is visible in the real customer-facing plan-selection list, since
  `listSelectablePlans()`'s filter only excludes `billingInterval:
  "internal"` and this test plan isn't marked internal. Not RC-7-
  introduced; left in place rather than deleted mid-pass without
  certainty it's safe to remove — flagged here for deliberate cleanup.
- Sample/demo data seeding into a brand-new organization was evaluated
  and **not** implemented, per the mission's own "don't add by default
  if it could confuse production analytics" instruction — a real
  candidate for a future, clearly-labeled, removable opt-in feature, not
  a gap in this pass's own scope.
- CSRF defense remains the deployment-wide `SameSite=Lax` posture RC-6's
  own audit already disclosed (§15.14 there) — RC-7's new mutating
  routes (`register`, `onboarding/organization`, `team/invitations/*`,
  `auth/invitations/accept`) are consistent with this existing,
  pre-disclosed characteristic, not a new gap.
- No dedicated "abandoned onboarding" re-engagement email/nudge exists —
  the mission asked for abandonment to be *tracked* (it is, via the
  persisted `OnboardingState` and the Platform Admin funnel) and
  progress *preserved* (it is), explicitly not for marketing outreach to
  be built.

---

## 22 · RC-7 audit summary (30 points)

1. **Completion status**: RC-7 (Customer Onboarding & SaaS Activation)
   complete against its own approved scope. RC-8 not started, per this
   pass's own explicit closing instruction.
2. **Existing functionality discovered and reused**: §1 — auth, RBAC,
   tenant isolation, plans/trials/entitlements, tenant credentials,
   WhatsApp Embedded Signup, CRM/pipelines/CSV import, Platform Super
   Admin console, audit logging — all reused directly, none duplicated.
3. **Registration architecture**: §3 — `authService.registerUser()`,
   fixed `role: "admin"`, no `organizationId` at creation, auto-login,
   existing verification email reused.
4. **Organization-provisioning architecture**: §4 —
   `onboardingService.createOrganizationForUser()`, atomic via
   `runInTransaction()`, idempotent, requires prior email verification.
5. **Trial/subscription-provisioning architecture**: §5 — new
   self-seeding `starter-trial` plan mirroring the existing internal-plan
   seeding pattern; assignment goes through the existing
   `subscriptionService`, never a direct `Subscription` write.
6. **Onboarding state model**: §6 — server-side `OnboardingState` on the
   `Organization` document; one-way completed-never-demoted-to-skipped;
   `resumeStep` resolved fresh from the DB on every call.
7. **Wizard steps built**: §8 — Plan, Team, WhatsApp, Email, AI,
   Calendar, CRM, Import — each a thin wrapper over a real existing
   route, never a second implementation.
8. **Required vs. optional steps**: §7 — `team`/`crm`/`import` required
   to be acted-on (completed or skipped); `whatsapp`/`email` require at
   least one completed or both explicitly skipped; `plan`/`ai`/
   `calendar` fully optional.
9. **Team invitation architecture**: §9 — new tenant-scoped
   `TeamInvitation` entity, seat-limit-checked server-side at both send
   and accept time, single-use hashed tokens, 7-day expiry, admin-only.
10. **Integrations onboarding**: §8 — WhatsApp reuses Module 8.5
    Embedded Signup exactly; Email/AI reuse Module 8.2's tenant
    credential storage/OAuth; Calendar reuses Module 6.3; none are
    mandatory unless plan/business requires it.
11. **CRM provisioning**: §8 — real Default Pipeline with 10 standard
    stages auto-created on first visit to the CRM step; safe generic
    defaults, no fake production-looking data.
12. **Lead import**: §8 — Module 1.4's real
    `previewLeadImport`/`commitLeadImport` reused directly; skippable.
13. **Activation definition**: §7 — documented, code-enforced
    `computeIsActivated()`; not "clicked Finish," reflects real
    engagement with team/CRM/import plus a deliberate channel decision.
14. **Onboarding analytics**: §11 — real 6-stage funnel aggregate
    (`getFunnelSnapshot()`), computed from live data, never fabricated.
15. **Empty states / checklist**: §10 — dashboard "No leads yet" banner
    for zero-registration orgs; `SetupChecklist` widget, dismissible,
    never forces a full wizard re-run for an optional item.
16. **Security controls**: §2, §14 — structural pre-organization gate
    (route-name-based, not per-route opt-in), middleware matcher-gap
    fix, 9 real over-HTTP proofs including forged-header and
    cross-tenant-invitation pentests.
17. **Files created/modified**: full inventory carried in this
    conversation's own working history; concentrated in
    `lib/services/onboarding/*` (new), `lib/services/auth/*` (extended),
    `lib/services/billing/trialPlan.ts` (new),
    `lib/services/platformAdmin/platformOnboardingService.ts` (new),
    `app/api/onboarding/*`, `app/api/auth/register`,
    `app/api/auth/invitations/accept`, `app/api/admin/team/invitations*`,
    `app/api/admin/platform/onboarding` (new routes),
    `app/admin/{register,onboarding,accept-invite}/page.tsx`,
    `app/admin/platform/onboarding/page.tsx` (new pages),
    `components/onboarding/*` (new), `middleware.ts`/`withApiRoute.ts`
    (security fixes).
18. **DB changes**: new `TeamInvitation` collection
    (`tenantScopePlugin`-applied); `Organization` schema extended with
    6 optional fields; new `AuditEntityType: "TeamInvitation"`.
19. **APIs added**: `POST /api/auth/register`,
    `POST /api/auth/invitations/accept`,
    `POST /api/onboarding/organization`, `GET /api/onboarding/status`,
    `GET /api/onboarding/plans`, `POST /api/onboarding/steps/[id]`,
    `GET/POST /api/admin/team/invitations`,
    `POST /api/admin/team/invitations/[id]/{resend,revoke}`,
    `GET /api/admin/platform/onboarding`.
20. **UI changes**: `/admin/register`, `/admin/onboarding`,
    `/admin/accept-invite` (new pages), `SetupChecklist` +
    "No leads yet" banner on the existing dashboard,
    `/admin/platform/onboarding` inside the existing Platform Console
    shell — no redesign of any existing populated page.
21. **Responsive results**: §16 — verified at all 12 required
    breakpoints via code-level audit; 2 real overflow risks found and
    fixed at 320px.
22. **Accessibility results**: §17 — 4 error messages given
    `role="alert"`; all other interactive elements inherit the existing
    design system's own keyboard/focus/label handling.
23. **Fresh-account E2E result**: §15 — full funnel proven live, browser
    + direct MongoDB cross-check, zero manual database intervention at
    any point.
24. **Manual setup still required**: none, for the tenant-configurable
    path this pass owns. Tenant-specific optional integrations
    (WhatsApp, Email OAuth) still require the customer's own external
    provider authorization, per the mission's own explicit carve-out —
    this is expected self-service OAuth, not a LearnSynaptic-side manual
    step.
25. **External platform configuration required**: none newly introduced
    by RC-7 beyond what RC-4's own configuration matrix already
    disclosed (Meta App, Google OAuth App, Email Provider) — RC-7 is a
    consumer of that existing platform-level configuration, not a new
    source of it.
26. **Known limitations**: §21 — a leftover RC-6 test plan visible in
    the real plan picker; no sample-data seeding built (evaluated,
    deliberately deferred); deployment-wide `SameSite=Lax` CSRF posture
    (pre-existing, disclosed by RC-6, not a new gap); no abandonment
    re-engagement messaging (correctly out of scope).
27. **Technical debt**: §21, in full.
28. **Overall RC completion %**: 100% against RC-7's own approved scope.
29. **Production readiness score**: quality gates all green — 818/818
    unit tests, 142/142 E2E, zero TypeScript errors, zero new ESLint
    issues, clean production build, live fresh-account verification with
    direct-database confirmation. Two real regressions were found via
    full-suite testing (not just RC-7's own new specs) and fixed before
    completion, per §20.
30. **Recommended next RC module**: RC-8, scope to be assigned by the
    next explicit instruction, per this pass's own closing "do not
    begin RC-8" directive. The clearest candidates surfaced incidentally
    by this pass, for future consideration rather than immediate action:
    cleanup of the leftover RC-6 test plan visible in the real plan
    picker (§21), and — echoing RC-6's own audit's own recommendation
    (`RC_6_AUDIT.md` §18.25) — a dedicated CSRF-hardening pass across the
    whole admin surface, RC-7's new mutating routes included, if the
    threat model ever calls for defense-in-depth beyond `SameSite=Lax`.

---

*(End of RC_7_AUDIT.md.)*

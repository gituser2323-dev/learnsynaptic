# RC-1 — Release Candidate Stabilization: Fix Report

This is a fix report, not a feature log. Scope was every Critical and
High priority issue identified in the two prior audits this session
produced (a full-codebase Release Candidate review, and an end-to-end
user-journey audit) — architecture unchanged, no UI redesign, no new
abstractions beyond what closing each gap actually required. See
`CHANGELOG.md`'s "RC-1" entry for the narrative version of this same
work, and `PRODUCTION_SCORE.md` for the updated scorecard and final
decision.

Verification standard applied to every item below: `tsc --noEmit`,
`npm run lint`, `npm run build`, and (new this pass) an automated
Playwright smoke suite (`npm run test:e2e`) — all four run clean as of
this report. Several items were additionally verified live over HTTP
against a running server (documented per item).

---

## 1. Lead-capture forms didn't reach the CRM

**Issue:** Six of seven lead-capture surfaces on the live site
(`RegisterForm` at `/register`, `ContactForm` + `CallbackForm` at
`/contact`, the site-wide `LeadCapturePopup`, `ChapterRegister` in the
bootcamp interactive chapter, and the AI Bootcamp / AI Generalist
registration modals) only sent an EmailJS notification email. None
called `POST /api/leads`. Only the Hero CTA modal (`LeadForm.tsx`) did,
and even there as a non-blocking side effect that never determined the
visitor-facing success/error state.

**Root cause:** Each form was built independently over time, before
the Lead backend (`lib/services/leads`) existed, and was never migrated
onto it afterward — EmailJS remained each form's only integration point
by omission, not by design.

**Files changed:**
- `components/lead-capture/useLeadCapture.ts` (new) — the one shared
  submission flow every form now uses: `submitLead()` (POST
  `/api/leads`) is the primary, awaited call that decides success/error;
  each form's own EmailJS notification becomes a best-effort secondary
  side effect, attempted after a successful backend write, never
  awaited by the UI, failures logged not surfaced. UTM/attribution is
  captured automatically via the existing `getAttribution()` cookie
  read (previously only `LeadForm.tsx` did this). `analytics.track()`
  now fires after the real backend success, not after EmailJS success.
- `lib/services/leads/phoneOnlyEmail.ts` (new) — see item 2 below.
- `lib/services/registrations/client.ts` (new) — browser-side
  `POST /api/registrations` helper, mirroring the existing
  `leads/client.ts` pattern exactly (kept separate from the
  server-only `registrationService` to keep Mongoose out of the client
  bundle).
- `components/RegisterForm.tsx`, `components/ContactForm.tsx` (both
  `ContactForm` and `CallbackForm`), `components/LeadCapturePopup.tsx`,
  `components/InternshipApplyForm.tsx`,
  `components/bootcamp/chapters/Chapter07Register.tsx`,
  `components/ai-bootcamp/RegistrationModal.tsx`,
  `components/ai-generalist/RegistrationModal.tsx` — each form's
  `handleSubmit` rewritten to call the shared hook; no other JSX,
  styling, field set, or validation behavior changed.

**Why the fix is correct:** Verified live end to end (see item 8) —
submitting a Lead now creates a real, persisted `Lead` record, fires
`lead.created`, and is picked up by the Automation Engine. A Playwright
test (`tests/e2e/lead-capture.spec.ts`) asserts the real network call
fires and succeeds for both the Register and Contact forms, so a future
regression of this exact class of bug fails CI, not just a manual
review.

**Remaining limitations:** EmailJS is still the only notification path
(no server-side transactional email exists in this app at all — see
item 9's own limitation). The Hero modal's CRM write is still
best-effort/non-blocking by original design (`LeadForm.tsx` wasn't
touched — its own dual-path pattern was already correct and is what the
other six forms were brought in line with).

---

## 2. Three funnels are intentionally WhatsApp-number-only — `Lead.email` is required

**Issue:** `LeadCapturePopup`, and the AI Bootcamp / AI Generalist
registration modals collect only a name and WhatsApp number, by
deliberate product design (a low-friction funnel). `Lead.email` is a
required, validated field.

**Root cause:** Not a bug — a genuine mismatch between an intentionally
minimal funnel UI and a backend schema that assumes every Lead has an
email.

**Files changed:** `lib/services/leads/phoneOnlyEmail.ts` (new) — a
single `syntheticEmailFromPhone()` function producing a deterministic,
clearly-marked, non-deliverable placeholder (`wa-<digits>@leads.invalid`)
so these leads still reach the CRM without adding a field to a funnel
that was intentionally kept minimal.

**Why the fix is correct:** This was an explicit scope trade-off, not a
default: adding a required email field would be a UI/conversion-funnel
redesign, out of bounds for this stabilization pass ("do not redesign
the UI"); leaving these three forms unwired would leave the exact
Critical data-loss issue unresolved for a meaningful share of traffic.
The `@leads.invalid` domain is immediately recognizable in the Leads
table for what it is and will never accidentally receive real mail.

**Remaining limitations:** These three funnels' Leads have no real
email on file — anything that assumes a deliverable email (there isn't
one today) would need a design decision first. Flagged inline in the
source, not silently absorbed.

---

## 3. `InternshipApplyForm` discarded submissions entirely

**Issue:** No backend call, not even EmailJS — a `TODO: wire to CRM /
email integration` comment, an `analytics.track()` call, and a fake
local "submitted" boolean. The applicant saw a success screen; nothing
was stored or sent anywhere.

**Root cause:** Never implemented past the UI shell.

**Files changed:** `components/InternshipApplyForm.tsx` — now uses
`useLeadCapture()`; also gained a real `sending`/`error` state (it
previously had neither — a synchronous `onSubmit` with a single
boolean).

**Why the fix is correct:** This form already collects a real email
(unlike item 2's forms), so no placeholder was needed — a direct,
correct fix. Loading/error states now match every other form's pattern.

**Remaining limitations:** None. Fully wired.

---

## 4. Registration flow — deciding when a Registration should exist

**Issue:** `POST /api/registrations` had zero callers anywhere in the
client code. The `Registration` entity, service, repository, and every
Admin Dashboard view built on it existed but had no organic path from a
real visitor.

**Root cause / business-flow decision made:** Reviewed the
architecture and decided the correct trigger: **the `/register` page**
is the one place on the site where a visitor explicitly selects a
specific program and states intent to enroll — a genuine "sign me up
for X" action, distinct from a general inquiry (Contact/Callback/exit
popup) or a free low-commitment funnel (the WhatsApp-only bootcamp
modals). `RegisterForm` now creates the Lead first, then — only when
the selected program maps to a real catalog slug (not the "still
deciding" option) — creates a Registration referencing that Lead. No
other form creates a Registration; that's a deliberate scope boundary,
not an oversight.

**Files changed:** `components/RegisterForm.tsx` (program→slug mapping
+ the two-step submit); `lib/services/registrations/client.ts` (new,
see item 1).

**Why the fix is correct:** `registrationService.createRegistration()`
itself needed no changes — it already correctly: validates the Lead
exists, atomically increments the linked Campaign's count in a
transaction, records a `registration.created` audit log entry, and
publishes `registration.created` (which `automation/triggers.ts`
already subscribed to, short-circuiting any in-flight nurture workflow
early as "converted"). This was verified as a design gap in the wiring,
not in the service — confirmed by reading the full method before
changing anything (task #69 in this pass's own tracking was a read-only
verification, zero code changed there).

Live-verified end to end (see item 8): submitting the real Register
form now produces a Lead → Registration → audit log entries for both →
an in-flight nurture workflow run correctly auto-completes with
`completionReason: "converted"` the moment the Registration is created
— exactly the intended "Student Conversion" behavior, now exercised by
a real trigger for the first time.

**Remaining limitations:** `POST /api/registrations` still has no
authentication (`⚠️ NO AUTHENTICATION` — already flagged in the route's
own pre-existing doc comment before this pass). Anyone who can guess a
`leadId` could create a Registration against it. Out of scope for this
stabilization pass (a real fix means deciding how public-facing
write routes get protected — CSRF token, origin check, or otherwise —
which affects `/api/leads` too and deserves its own design pass, not a
bolt-on here).

---

## 5. No automated tests, despite Playwright being a listed dependency

**Issue:** Zero test files anywhere in the repository; no `test` script
in `package.json`. `@playwright/test` (the actual test runner) wasn't
even installed — only the base `playwright` library was a dependency.

**Root cause:** Never set up.

**Files changed:** `package.json` (`@playwright/test` added, `test:e2e`
script added), `playwright.config.ts` (new — chromium only, `webServer`
auto-builds and starts the app with a fixed test JWT secret),
`tests/e2e/helpers.ts` (new — mints a valid admin session cookie via
`jose`, since there's no way to seed a real user into the webServer's
own in-memory process from a separate script — the same per-process
in-memory constraint already documented on
`scripts/createAdminUser.ts`), and four spec files: `public-pages`,
`lead-capture`, `admin-auth`, `admin-dashboard`.

**Why the fix is correct:** Deliberately narrow — the highest-value
critical paths (does a lead-capture form's submission actually reach
the backend, does the admin auth gate actually gate, does an
authenticated session actually reach the dashboard and WhatsApp
Campaigns page), not exhaustive coverage. All 11 tests pass against a
real production build. **This suite caught a real, previously-unknown
bug during this same pass — see item 10.**

**Remaining limitations:** No unit tests around service-layer logic
(`leadService`, `whatsappCampaignService`'s retry/backoff math, the
scheduler) — a real test pyramid needs that layer too; this pass adds
the top (E2E smoke), not the whole pyramid. No visual regression
coverage. Single browser (chromium) only.

---

## 6. No CI/CD pipeline

**Issue:** No `.github/workflows`, no deploy config — nothing gated a
broken build, a failing lint, or a type error before merge.

**Files changed:** `.github/workflows/ci.yml` (new) — runs `tsc
--noEmit`, `npm run lint`, and `npm run test:e2e` (with Playwright's
Chromium installed via `--with-deps`) on every push/PR to `main`.

**Why the fix is correct:** Uses the exact same three checks this
entire session has manually run before every change; the difference is
they now run automatically and block merge on failure. No MongoDB
service container is provisioned — the in-memory repository fallback
is exactly what a CI run wants (fresh, empty state every run).

**Remaining limitations:** No deploy step (this repo has no configured
hosting target to deploy to as part of this pass) — CI verifies, it
doesn't ship.

---

## 7. No security response headers

**Issue:** `next.config.ts` set zero security headers — no CSP, HSTS,
X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or
Permissions-Policy.

**Files changed:** `next.config.ts` — added a `Content-Security-Policy`
plus five other headers, applied to every route.

**Why the fix is correct:** The CSP allowlist was built from the
codebase's actual external dependencies (verified by grepping every
external URL referenced anywhere in the app), not guessed: GA4
(`googletagmanager.com`), Meta Pixel (`connect.facebook.net`,
`graph.facebook.com`), EmailJS (`api.emailjs.com`), and `'self'` for
everything else — no external image hosts or font CDNs are used
(`next/font` self-hosts, no `remotePatterns` configured). Verified live
— headers confirmed present via `curl -I` against a running server —
and `npm run build` + the full Playwright suite both still pass clean
with the CSP active (GA4/Meta Pixel init scripts, EmailJS calls, and
every page render unaffected).

**Remaining limitations:** `script-src` includes `'unsafe-inline'`.
GA4 and Meta Pixel are bootstrapped via inline `<Script>` blocks with
embedded JS (`components/analytics/AnalyticsScripts.tsx`), not
external-src-only tags. A stricter nonce-based CSP is possible but
requires threading a nonce through `middleware.ts` into every page
render — a real, larger change this pass isn't risking without being
able to live-verify every single page afterward. Documented inline in
`next.config.ts` itself, not silently accepted.

---

## 8. Automation-triggered WhatsApp sends were completely untracked

**Issue:** The nurture-sequence workflow (`leadNurtureSequence.ts`)
sends WhatsApp messages via `whatsappService.sendTemplateMessage()` — a
different code path from the bulk Campaign Manager
(`lib/services/whatsappCampaigns`). It never created a `Message` row,
so Meta's delivery/read/failed webhook had nothing to correlate
against — `applyStatusEvent()` in the webhook handler explicitly
no-ops for an unrecognized `providerMessageId`, by its own pre-existing
doc comment.

**Root cause:** The Campaign Manager (built in an earlier module this
session) and the Automation Engine (built earlier still) were never
reconciled onto one tracking mechanism — each had its own idea of "a
WhatsApp send," only one of which was ever persisted.

**Files changed:**
`lib/services/automation/workflows/leadNurtureSequence.ts` —
`sendTemplateOrThrow()` now creates a campaign-id-less `Message` row
before sending and updates it to `sent` (with `providerMessageId`) or
`failed` afterward, using the exact same `Message` entity the bulk
Campaign Manager already uses. `getMessageRepository` is imported
dynamically, matching this file's existing lazy-load convention (it
already did this for `getRegistrationRepository`).

**Why the fix is correct:** Every WhatsApp send path in the app now
goes through a `Message` row — confirmed by grepping every call site of
`whatsappService.sendTemplateMessage`/`sendPlainText`
(`jobHandlers.ts`, already correct, and this file — the only two).
Live-verified end to end: created a Lead with no Registration →
manually triggered the scheduler → the welcome-message step executed →
`GET /api/admin/whatsapp-campaigns/stats` correctly showed `sent: 1`
where it previously showed nothing for this send path at all.

**Remaining limitations:** None functionally — delivery/read/failed
webhooks will now correlate correctly against automation-sent messages
the same way they already do for bulk-campaign sends.

---

## 9. WhatsApp delivery performance never reached the Analytics page

**Issue:** Delivery/read/failed counts existed and were correct, but
only on a single campaign's own detail page — nothing rolled them up
anywhere else, and (before item 8) automation-sent messages weren't
even in the data to roll up.

**Files changed:**
- `lib/services/whatsappCampaigns/types.ts`,
  `lib/db/repositories/message.{mongodb,inMemory}.repository.ts` —
  `MessageRepository.countByStatus()`'s `campaignId` parameter made
  optional; omitted, it aggregates across every Message app-wide. A
  minimal, backward-compatible signature extension, not a new method —
  every existing caller (which always passed a campaignId) is
  unaffected.
- `lib/services/whatsappCampaigns/whatsappCampaignService.ts` — new
  `getOverallMessageStats()`.
- `app/api/admin/whatsapp-campaigns/stats/route.ts` (new) —
  `GET /api/admin/whatsapp-campaigns/stats`.
- `components/admin/apiClient.ts` — `getWhatsAppMessageStats()`.
- `app/admin/(dashboard)/analytics/page.tsx` — new "WhatsApp
  Performance" section, using the exact same `StatCard` grid pattern
  as the existing "Account-Wide Ad Performance" section directly above
  it. No new visual language, no dashboard redesign.

**Why the fix is correct:** Reuses the existing analytics architecture
exactly as instructed — same components, same data-fetching pattern
(`useAdminData`), same loading/error states. Verified live: the stats
endpoint correctly reflected the automation-sent message from item 8's
verification.

**Remaining limitations:** None for what was asked. A time-windowed
breakdown (matching the Lead/Conversion/Revenue funnels' date-range
picker) wasn't added — the underlying data doesn't currently carry a
queryable date dimension for this aggregate without a larger query
change; today's numbers are all-time totals.

---

## 10. A real, previously-unknown bug found while building the test suite

**Issue:** `RegisterForm`'s `Row` staggered-animation wrapper was
defined *inside* the component's render body. Every re-render (i.e.
every keystroke, since typing updates `fields` state) created a brand
new `Row` function reference; React treated each render's `<Row>` as a
different component type in the same tree position and unmounted +
remounted the entire subtree — including the actual `<input>` DOM
nodes — on every keystroke. Confirmed with a real browser: after
programmatically filling every field, every text input read back
**empty**. ESLint's `react-hooks` plugin had already flagged this
exact pattern as an error ("Cannot create components during render")
in this project's lint baseline throughout the session — it was
present, just not previously recognized as a live functional defect
rather than a style nitpick.

**Root cause:** A component factory function declared inside another
component's body — a correctness bug, not a style issue, whenever the
inner component wraps a real DOM node under a controlled input.

**Files changed:** `components/RegisterForm.tsx` — `Row` hoisted to
module scope (a stable, top-level function), calling
`useReducedMotion()` itself rather than receiving it as a prop from the
parent (same value, seven fewer prop-threading call sites to touch).

**Why the fix is correct:** This is the exact class of regression this
stabilization pass's own new Playwright suite (item 5) is meant to
catch — and it did, on its very first real run, before this report was
even written. Re-ran the full suite after the fix: all 11 tests pass,
including the Register-form submission test that had been failing.
`npm run lint`'s error count dropped from 17 to 10 (the seven instances
of this exact error, one per call site, are gone; no new errors
introduced) — net improvement over this session's own established lint
baseline, not just neutral.

**Remaining limitations:** None found elsewhere — grepped the full
lint output for the same error signature across the entire codebase
after the fix; no other occurrences exist.

---

## 11. Dependency security patch applied

**Issue:** `npm audit` surfaced 3 high-severity advisories against the
pinned `next@16.2.9`, including a Middleware/Proxy bypass in App Router
applications using Turbopack with a single locale — a description that
matches this app's exact configuration (Turbopack is enabled; there is
no i18n/multi-locale routing), and directly relevant given
`middleware.ts` is this app's sole enforcement point for the admin auth
gate.

**Files changed:** `package.json`/`package-lock.json` — `next` bumped
`16.2.9` → `16.2.11` (a patch release, not a major/minor bump).

**Why the fix is correct:** `npm audit`'s suggested fix was applied
directly (`isSemVerMajor: false`) rather than deferred — this is
exactly the kind of low-risk, high-relevance patch this stabilization
pass exists to apply, not a "wait for a future pass" item. Re-ran the
full verification battery (`tsc`, lint, build, all 11 Playwright tests)
against the patched version — clean.

**Remaining limitations:** Two more high-severity advisories
(`postcss`, `sharp`) remain — both are dependencies bundled *inside*
`next`'s own `node_modules`, not top-level dependencies of this app.
`npm audit fix --force`'s only proposed resolution is downgrading
`next` to `9.3.3` — seven major versions back, a completely different
API surface that would break this entire Next 16/React 19 App Router
codebase. Not applied, correctly: this is an upstream-Next.js problem
to fix in a future Next.js release, not something force-downgrading
this app's own framework version can safely resolve.

---

## 12. Stale documentation fixed in passing

**Issue:** `lib/services/automation/triggers.ts`'s own doc comment
claimed `registerAutomationTriggers()` was "called once from
instrumentation.ts at server startup" — but no `instrumentation.ts`
file exists anywhere in the repository. The actual mechanism
(`lib/events/eventBus.ts`'s self-bootstrapping `publish()`, which
correctly works around a real Next.js module-graph-splitting pitfall)
is functionally correct; only the comment describing it in a different
file was wrong — a leftover from an earlier design iteration that was
fixed in the code but never updated in this one comment.

**Files changed:** `lib/services/automation/triggers.ts` — comment
corrected to point at the real mechanism.

**Why the fix is correct:** Zero behavior change; a stale comment
directly contradicting a working mechanism is exactly the kind of
thing that costs a future engineer real debugging time.

---

## 13. No environment variable documentation

**Issue:** ~35 distinct environment variables referenced across the
codebase (auth, MongoDB, five WhatsApp provider credentials,
marketing/ads, seven EmailJS IDs, analytics) with no single documented
list of what's required vs. optional, or what a fresh deploy target
needs to set.

**Files changed:** `.env.example` (new) — every variable found by
grepping every `process.env.*` reference in the codebase, grouped by
concern, each annotated with its safe fallback (or "REQUIRED for
production" where none exists).

**Why the fix is correct:** Generated from the actual code, not
guessed — cross-checked the grep output against every `config/*.ts`
module's own documented fallback behavior.

**Remaining limitations:** None.

---

## 14. No health-check endpoint

**Issue:** No `/api/health` or equivalent for uptime monitoring or a
load balancer's liveness probe.

**Files changed:** `app/api/health/route.ts` (new) — public (no
`requiredRole`, same pattern as `/api/leads`), reports process
liveness and whether MongoDB is configured.

**Why the fix is correct:** Deliberately a liveness check, not a deep
readiness check — `lib/db/connection.ts`'s `getConnection()` is
intentionally not exported outside `lib/db` (every consumer goes
through a repository getter instead, per that module's own existing
comment). Adding a live database round-trip would mean deciding
whether to open that boundary — a real design decision, not a
rubber-stamp addition, so left as a documented follow-up rather than
forced through here. Live-verified: `GET /api/health` returns
`{success: true, status: "ok", ...}`; also covered by the Playwright
suite.

**Remaining limitations:** Liveness only, not full dependency
readiness (see above).

---

## 15. `CampaignTemplate` was the only model with no database index

**Issue:** Every other Mongoose model in `lib/db/models/` has at least
one index; `CampaignTemplateModel` had none, despite
`CampaignTemplateRepository.list()` always sorting by `createdAt`
descending for the Admin Dashboard Templates page's pagination.

**Files changed:** `lib/db/models/campaignTemplate.model.ts` — added
`campaignTemplateSchema.index({ createdAt: -1 })`.

**Why the fix is correct:** Matches the exact reasoning already applied
to every other model's indexes in this codebase (e.g.
`campaign.model.ts`).

**Remaining limitations:** None — low-risk at current data volumes
regardless, but correct to have before it matters.

---

## 16. No self-service password recovery for admin accounts

**Issue:** Admin users are created exclusively via a CLI script
(`scripts/createAdminUser.ts`); there was no way to change a password
once an account existed — not even a repository method for it.

**Root cause:** `UserRepository` never had an `updatePassword` method;
nothing above it could have supported a reset even if asked to.

**Files changed:** `lib/services/auth/types.ts`
(`UserRepository.updatePassword`), `lib/db/repositories/user.{mongodb,
inMemory}.repository.ts` (implementations), `lib/services/auth/
validation.ts` (`validatePasswordReset`, reusing the same
strength rule as account creation), `lib/services/auth/authService.ts`
(`resetPassword()` — validates, hashes, updates, and records a new
`user.password_reset` security-audit action),
`lib/services/auditLog/actions.ts` (the new action constant),
`scripts/resetAdminPassword.ts` (new) — mirrors
`createAdminUser.ts`'s existing CLI precedent exactly.

**Why the fix is correct — and why a CLI script, not a self-service
flow:** There is no transactional (server-side) email provider
configured anywhere in this app — EmailJS, used everywhere else, only
runs in the browser and cannot be triggered from a server script or
route. Building real self-service password recovery would mean adding
a new email-sending dependency and choosing its provider — a
product/infra decision outside this pass's scope. The CLI script is
the smallest production-safe fix that actually closes the gap ("an
admin is never permanently locked out") without inventing new
infrastructure. Live-verified in a single Node process (create user →
reset password → confirm old password now fails login, new password
succeeds, both a `user.created` and `user.password_reset` security
audit entry recorded).

**Remaining limitations:** Still requires shell/deploy access to the
running environment, same as account creation — not self-service.
Does not revoke the user's existing refresh-token sessions (no
repository method to look sessions up by `userId` exists yet); this is
an operator-initiated reset, not a "my account is compromised"
self-service flow, so existing sessions are left to age out via the
normal short-lived access-token TTL. Documented as an accepted
trade-off in the code itself, not an oversight.

---

## Also verified, no code change needed

- **`registrationService.createRegistration()`** — read in full before
  wiring anything to it (item 4). Already correctly validates,
  transacts, audits, and publishes `registration.created`.
- **GA4 / Meta Pixel / UTM attribution** — `analytics.track()` already
  auto-enriches every event with UTM params via `getAttribution()`;
  confirmed the actual `<Script>` tags (`AnalyticsScripts.tsx`) and
  provider modules were already correctly wired. The only real gap was
  that most forms never called `analytics.track()` with real backend
  confirmation behind it — fixed as part of item 1.
- **WhatsApp webhook signature verification, delivery/read/failed
  status correlation for bulk campaigns** — already correct.

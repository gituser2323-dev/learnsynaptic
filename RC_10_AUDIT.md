# RC-10 — V1.0 Final Production Launch Gate

Companion to `CHANGELOG.md`'s own RC-10 entry. This is the FINAL V1.0
release gate: not a test pass, not a feature pass — an honest
determination of whether LearnSynaptic Business OS can safely onboard
its first real, paying external SaaS customer today, and exactly what
stands between "the code is ready" and "a real customer is live."

**Mission scope, verbatim intent**: RC-10 is primarily an audit and
launch-gate phase. Do not choose GO simply because the code builds. Fix
only what is small, bounded, proven, and low-risk; everything else
becomes a precise, named CONDITIONAL GO item, never silently absorbed
into "done."

---

## 1 · RC-9 closure — independently reverified, not trusted

Re-derived from the live codebase and a live test environment, not from
the prior report:

- `npx tsc --noEmit` — clean (re-run from scratch).
- `npx vitest run` — **834/834 passing across 94 files** (re-run from scratch).
- `npx next build` — clean, exit 0 (re-run from scratch).
- **F-11 (CRITICAL, cross-tenant automation) re-verified live**: created a fresh public lead via the real, unauthenticated `POST /api/leads`; direct MongoDB query confirmed **zero** `WorkflowRun` documents were created for it and **zero** orphaned (`organizationId`-missing) `WorkflowRun`s exist system-wide — including against a real, currently-active Org A workflow definition confirmed still present in the database.
- **F-19 (CRITICAL, staff-directory leak) re-verified live**: `GET /api/admin/users` as Org A's own admin returns exactly Org A's 3 staff, zero cross-organization records.
- **Fresh spot-checks this session** (not previously run): cross-tenant lead read → 404; unauthenticated admin request → 401; tenant admin on a platform-only route → 403; counsellor on a manager-tier route → 403 — all exactly as required.
- Secret scan: zero matches for the real `JWT_ACCESS_TOKEN_SECRET`/`CRON_SECRET` values anywhere in `.next/static`.
- `.env.local` confirmed gitignored and not tracked by git.

**RC-9's own closure claims hold under independent re-verification.** 0 open Critical, 0 open High, 0 open Medium findings confirmed still true.

**One new observation from this reverification pass**: this repository genuinely is a git repo (contrary to earlier session context), with **123 uncommitted changes** (76 modified + 47 new files) and a last real commit dated 2026-08-04 — essentially all of RC-5 through RC-9's work has never been committed. Not a code defect; a concrete pre-deployment step (§26).

## 2 · Product gap review

Every disclosed gap from RC-1 through RC-9 was independently re-checked against the live codebase (not assumed from memory):

| Item | Status confirmed | Classification |
|---|---|---|
| Counsellor/Manager cannot access Conversations (Admin-only RBAC) | Still open — live-confirmed the Conversations inbox is fully functional but reachable by Admin only | **FIX BEFORE FIRST CUSTOMER** (functional, not security — see §16) |
| Customer-visible request/correlation ID | Still open — `requestId` generated, logged, audited, never returned to the client | FIX AFTER LAUNCH (small, safe, good support hygiene) |
| Support impersonation | Still not built (0 matches) — deliberately deferred, a partial version would itself be the insecure pattern to avoid | OPTIONAL / FUTURE |
| Platform-wide announcements | Still not built — the audit-log action constant exists but is genuinely dead code, never dispatched | OPTIONAL / FUTURE |
| Admin force-password-reset for another user | Still not built — only self-service forgot-password + admin session-revoke exist | FIX AFTER LAUNCH |
| Admin MFA recovery for a locked-out user | Still not built, but real mitigations already exist (10 recovery codes at setup + a real email-OTP fallback path); MFA is opt-in, not deployment-mandatory except for Platform Super Admin | FIX AFTER LAUNCH (narrow edge case) |
| Encryption key rotation (4 master AES secrets) | No rotation/re-encryption tooling exists — but `lib/startupValidation.ts` already prevents the far more dangerous "silently running on the known dev-fallback key" scenario with a loud production-boot error | OPTIONAL / FUTURE |
| Queue replay/idempotency | Re-checked — real retryable/non-retryable distinction on the platform failed-job retry route, consistent with RC-5's own replay-safety classification. No new gap. | CLEAN |
| Remaining LOW RC-9 findings (F-12, F-16) | Both already correctly disclosed and accepted — neither security, data-loss, nor scale-proven at any realistic near-term org size | OPTIONAL / FUTURE, no action |
| Test/demo plan visible to real customers | The RC-7-disclosed issue is **confirmed already fixed** — `listSelectablePlans()` explicitly filters the internal fallback plan out of the customer-facing picker. The REAL current state: **zero real commercial plans exist anywhere yet**, but the platform owner can create one through the product's own UI, no code needed | BEFORE FIRST CUSTOMER (operational, not code) |

## 3 · First-customer workflow trace

Full funnel already proven end-to-end in a real browser during RC-9 (register → real verification email → sign in → 8-step self-service wizard → working dashboard, zero manual database edits). This pass extended live verification to the remaining steps:

- **Automation/Workflows** (`/admin/automation`): real, self-service workflow catalog with a "New workflow" creation flow. The page's own "no automatic cron wired up yet, trigger a tick manually" text refers to a convenience manual-trigger button — confirmed a real `vercel.json` cron entry (`*/5 * * * *` → `/api/cron/run-due-jobs`) already exists, so automation execution is genuinely automatic once deployed, not manual-only.
- **Conversations** (`/admin/conversations`): real, fully-functional inbox (assign/reassign, labels, real message threads, AI Conversation Insights). Confirms the RBAC gap's real, tangible impact — this is the primary lead-communication surface, and Counsellor/Manager cannot reach it at all.
- **Campaigns**: real, self-service list/filter/export (creation already proven via real API calls throughout RC-9).
- **Settings → Billing**: real, live per-org usage metering shown to the tenant admin (team members, WhatsApp messages this month, file storage) against their current plan.
- **New finding this pass**: `POST /api/admin/billing/subscription/assign-plan` is a genuine, correctly-scoped, tenant-self-service upgrade/downgrade route (`requiredRole:"admin"`, resolves the caller's own org) — but a full search of `components/admin` found **zero frontend code anywhere that calls it**. The backend capability is real and safe; there is currently no UI for a real customer to use it. Today, a plan change requires the platform owner to act via the Platform Console.
- **Reliability** (`/admin/reliability`): a genuinely valuable, real, TENANT-scoped observability dashboard (queue depth, DLQ, failure rate, retry rate, per-job detail) — a strong positive finding, not previously catalogued at this level of detail.

Every point requiring manual intervention beyond the customer's own self-service actions is enumerated in §22.

## 4 · API vs. configuration matrix — see §29 (the one authoritative table)

## 5 · WhatsApp go-live checklist

| Item | Status |
|---|---|
| Meta Cloud API adapter | IMPLEMENTED |
| Embedded Signup (client popup → server exchange → tenant-isolated connection) | IMPLEMENTED |
| Webhook signature verification (fail-closed, HMAC, constant-time) | IMPLEMENTED, LIVE VERIFIED (RC-9 F-13) |
| Phone quality/messaging-limit tracking (`quality_rating`, `messaging_limit_tier` from Meta's own Graph API) | IMPLEMENTED |
| Template sync | IMPLEMENTED |
| Meta App, Business Portfolio, WABA, Business Verification | NEEDS MY META CONFIGURATION — Meta's own dashboard, cannot be done from this codebase |
| Production messaging limits / phone quality grant | NEEDS META APPROVAL — Meta's own process |
| Access Token / App Secret / Webhook Verify Token / Business Account ID / App ID / Embedded Signup Config ID | CREDENTIALS REQUIRED (env vars, all named in §14) |
| A tenant self-connecting their own WABA | NEEDS CUSTOMER ACTION (their own Meta Business login via Embedded Signup — once the platform's own Meta App is live) |
| Real, live send/receive against a real WhatsApp number | Never attempted anywhere in this project's history (correctly — no real vendor account exists in any test environment) |

## 6 · Email go-live checklist

| Item | Status |
|---|---|
| Postmark adapter (the one real, fully-implemented vendor) | IMPLEMENTED |
| Inbound webhook (shared token, not HMAC — matches Postmark's own model) | IMPLEMENTED |
| SendGrid / Resend | CODE READY (disclosed scaffolds — throw until implemented) |
| Server token / from address / inbound token | CREDENTIALS REQUIRED |
| Sender domain verification, SPF, DKIM, DMARC | DNS CONFIGURATION REQUIRED + PROVIDER DASHBOARD CONFIGURATION REQUIRED (Postmark's own domain-verification flow; none of this is application code) |
| Bounce handling | Not independently verified this pass — Postmark's own dashboard-level feature |
| Rate limits | Postmark-plan-dependent, external to this app |

Code readiness and deliverability readiness are cleanly separable here: the code path is complete; deliverability is 100% a DNS + vendor-dashboard exercise.

## 7 · AI go-live checklist

| Item | Status |
|---|---|
| OpenAI / Anthropic / Gemini adapters (real, fetch-based, no SDK) | IMPLEMENTED |
| Platform vs. tenant key | **Platform-level only — no BYOK exists anywhere** (confirmed: zero matches for tenant-supplied AI credentials) |
| Model configuration | Real, per-provider env var (`OPENAI_MODEL`/`ANTHROPIC_MODEL`/`GEMINI_MODEL`), sensible defaults |
| Usage accounting | Real — `ai_requests` is a genuine, numeric, per-organization `UsageMetric`, enforced through the same race-tested `usageService`. Not currently surfaced on the Settings → Billing UI card (shows 3 of 9 real metrics) — a minor completeness gap, not a functional one |
| Timeout/fallback | Real — every provider call is wrapped in `AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS)`, `maxTokens` bounded (1024 default) |
| Rate limiting | Bounded per-call cost via the timeout/token cap above; no separate per-tenant AI rate limit beyond the general API rate limiter |
| Missing key behavior | Correct, real, graceful degradation — a persisted "unavailable" status, never a fabricated result |
| Cost exposure | **A real, shared PLATFORM cost today** — one key, one bill for the whole deployment, not itemized or charged per tenant beyond the existing usage metering |

## 8 · Payments go-live checklist

| Item | Status |
|---|---|
| Razorpay / Stripe / Cashfree adapters | IMPLEMENTED |
| PhonePe / PayPal | CODE READY (explicit scaffolds, throw `PaymentProviderNotImplementedError`, named "(future)" in their own mission) |
| Webhook signature verification (real per-provider HMAC) | IMPLEMENTED, independently re-confirmed this pass |
| **Idempotency** | IMPLEMENTED — a genuine unique+partial MongoDB index on `(provider, providerEventId)` in a dedicated `PaymentWebhookEvent` collection (independently re-read directly in `lib/db/models/paymentWebhookEvent.model.ts` this pass, not just trusted from the prior report) |
| Plans / Prices / Subscriptions / Renewals / Cancellation | IMPLEMENTED (see §18) |
| Failed payment / Refund behavior | Real status states exist on the Payment model (`failed`, `refunded`, `partially_refunded`); refund flow real per RC-9's own prior verification |
| Entitlement updates | Real, immediate (`getEntitlements()` always resolves against the current Plan document, never a frozen snapshot) |
| Live credentials | Not configured in any test environment |
| **SANDBOX VERIFIED vs. LIVE MONEY VERIFIED** | **SANDBOX VERIFIED only** — every real-vendor-API check performed anywhere in this project's history used intentionally invalid/test keys to confirm correct rejection. **Real money has never been processed, correctly, per every RC's own explicit instruction never to do so just to satisfy testing.** |

## 9 · Storage go-live checklist

| Item | Status |
|---|---|
| `local` / `aws_s3` / `cloudinary` adapters | IMPLEMENTED (all 3 real; Cloudinary's private/authenticated delivery is a disclosed, real gap — use S3 for private files) |
| Production-safety check | **Already built and real**: `lib/startupValidation.ts` loudly errors at real production boot if `STORAGE_PROVIDER` is unset/"local" — directly anticipates and defends against exactly the risk this mission section warns about |
| Credentials / bucket / access policy | CREDENTIALS REQUIRED (none configured in any test environment) |
| Tenant isolation, signed URLs, upload limits | IMPLEMENTED, RC-9-tested (F-06 fixed a real no-extension-filename crash this pass's predecessor) |
| Backups | Follows the underlying provider's own (S3 versioning / Cloudinary) — no app-level backup layer needed or built |
| Current environment | `STORAGE_PROVIDER` unset → `local` (correct dev default; **not production-ready if this deployment is serverless**, exactly as the startup check itself warns) |

## 10 · Database (MongoDB) go-live

- **Current tier: none — `MONGODB_URI` still points at a local, unmanaged `mongod` instance (this session's own isolated test environment).** No real MongoDB Atlas (or equivalent managed) cluster has ever been provisioned for this project.
- Backups: local `mongodump`/`mongorestore` tooling is real and was re-verified this session (RC-9 F-23) — but `DR_RUNBOOK.md` itself already, explicitly, in its own words, warns this is NOT a substitute for managed Cloud Backup, and flags the free/shared Atlas tier's total lack of automated backup as **"the single highest-severity item in this document."**
- PITR: only available on Atlas M10+ with Cloud Backup enabled — not yet provisioned.
- Connection limits: connection pooling is already serverless-aware (`maxPoolSize:10`, `minPoolSize:0`, shared cached connection per warm instance) — no per-deployment tuning needed.
- Indexes: `autoIndex` auto-disables in production; `npm run db:sync-indexes` is the real, documented, deliberate post-deploy step.
- Monitoring/alerts: Atlas's own built-in monitoring, once provisioned — nothing to build in-app.
- **Explicit verdict: the current database plan (none — local/unmanaged) is NOT acceptable for a first paying customer.** This is the single most concrete, highest-priority infrastructure gap found in this entire audit.

## 11 · Queue / "Redis" go-live

**This app has no separate queue/Redis service, by deliberate architecture decision (RC-3).** The real, deployed queue IS the MongoDB-backed scheduler, drained by Vercel Cron. There is no Redis to provision, size, or budget for separately — this significantly simplifies production infrastructure relative to what a generic "Queue/Redis" checklist implies. Retry, DLQ, tenant-context preservation, and idempotency across the job pipeline were all extensively re-verified throughout RC-9. Reliability reduces entirely to §10 (MongoDB) + CRON_SECRET (§12).

## 12 · Cron / Scheduler

Real `vercel.json` cron entry confirmed: `{"path":"/api/cron/run-due-jobs","schedule":"*/5 * * * *"}`. Requires deploying on a platform with real cron support (Vercel's free Hobby tier's cron limits are restrictive for a 5-minute schedule — realistically a paid tier) plus `CRON_SECRET` set. Campaign and automation scheduling both run through this same, single, already-tested mechanism.

## 13 · Domain / DNS

- `APP_BASE_URL` — used for verification/invitation email links; falls back to a relative path if unset (works for same-domain opens, not safe to rely on generally).
- OAuth callbacks (social login + Calendar connectors) — each vendor requires an exact-match redirect URI registered in its own dashboard, tied to the real production domain.
- **CSRF/same-origin protection is genuinely domain-independent** — `isSameOriginRequest()` compares the request's own `Origin` against its own `Host` header, never a hardcoded config value. Correct in every environment with zero DNS-dependent configuration — a strong, directly-confirmed positive finding.
- Cookie domain — no explicit `domain` attribute anywhere; defaults to exact-host scoping, the safe choice, no DNS-linked config needed.
- Email DNS (SPF/DKIM/DMARC) — see §6.
- Concrete checklist for the owner: own a real domain → point it at the deployment (HTTPS automatic on Vercel) → register that domain's callback URLs in every OAuth vendor dashboard used → configure email-sending DNS records.

## 14 · Environment variables

`.env.example` (463 lines) is already a complete, categorized, self-documenting reference — REQUIRED / RECOMMENDED / PLATFORM / TENANT-AWARE / PUBLIC / OPTIONAL tags built directly into the file with real reasoning per variable, cross-checked directly against `lib/startupValidation.ts`'s own real enforcement list this pass. No secret VALUES are reproduced anywhere in this audit — names and status only.

- **REQUIRED FOR CORE**: `MONGODB_URI`, `JWT_ACCESS_TOKEN_SECRET`, `MFA_ENCRYPTION_SECRET`, `AUTH_OAUTH_STATE_SECRET`, `TENANT_CREDENTIAL_ENCRYPTION_SECRET`, `WEBHOOK_SECRET_ENCRYPTION_SECRET`, `CALENDAR_TOKEN_ENCRYPTION_SECRET`, `CRON_SECRET`, `PLATFORM_ADMIN_SECRET`.
- **REQUIRED FOR WHATSAPP**: `WHATSAPP_PROVIDER` + `WHATSAPP_META_*` (only if relying on a platform-level shared number rather than exclusively tenant Embedded Signup connections).
- **REQUIRED FOR EMAIL**: `EMAIL_PROVIDER` + `EMAIL_POSTMARK_*`.
- **REQUIRED FOR AI**: `AI_PROVIDER` + one of `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`.
- **REQUIRED FOR PAYMENTS**: one of `RAZORPAY_*`/`STRIPE_*`/`CASHFREE_*` (only the providers actually offered).
- **REQUIRED FOR STORAGE**: `STORAGE_PROVIDER=aws_s3` or `cloudinary` + matching credentials (NOT `local` in production).
- **REQUIRED FOR OBSERVABILITY**: `ERROR_TRACKING_PROVIDER=webhook` + `ERROR_TRACKING_WEBHOOK_URL` (optional but strongly recommended — degrades safely to stdout-only logs otherwise).
- **OPTIONAL**: every TTL/tuning var, social-login OAuth vars, calendar OAuth vars, marketing/analytics vars, `NEXT_PUBLIC_*` vars, virus-scan provider.

## 15 · Login & security go-live

**Is authentication safe enough for external customers? YES.**

Evidence: independently reverified this session (§1) — unauthenticated → 401, cross-tenant → 404, platform route as tenant admin → 403, RBAC violation → 403, both CRITICAL cross-tenant fixes confirmed live and via direct database query. RC-9's own 26-check auth attack suite (brute force, spraying, enumeration resistance, every token type's replay/expiry/forgery, MFA bypass attempts, recovery-code reuse, session fixation/replay, OAuth state manipulation, open redirect) — 26/26 pass, reconfirmed via full regression this session. CSRF protection is domain-independent and correctly implemented. Real per-account lockout exists independent of IP. Every credential class (passwords, MFA secrets, tenant integration credentials, webhook secrets, calendar tokens) is genuinely encrypted at rest with real AES-256-GCM authentication-tag verification, not just encoded. The two remaining disclosed gaps (no admin-assisted password/MFA reset for another user) are availability/support-operations gaps, not authentication safety gaps — self-service recovery (forgot-password, MFA email-OTP fallback, recovery codes) covers the overwhelming majority of real cases.

## 16 · Customer role experience

Verified real business workflows, not just permission status codes, live in a real browser this pass:

- **Counsellor / Manager**: full CRM workflow (Leads, Tasks, Pipeline) confirmed usable in principle (RC-9's own extensive RBAC/tenant testing), BUT **the known Conversations gap is confirmed still real and materially significant** — the Conversations inbox (assignment, labels, AI insights, the actual message thread) is Admin-only. For a WhatsApp/Email-centric CRM whose stated purpose is lead communication, a Counsellor/Manager who cannot open the inbox at all is a genuine, day-to-day operational limitation, not a cosmetic one. This is the single clearest FIX BEFORE FIRST CUSTOMER item in the entire product-gap review, for any customer whose team includes non-Admin staff who need to message leads directly.
- **Tenant Admin**: full access confirmed, including the newly-discovered Reliability dashboard and real usage-metered Billing card.

## 17 · Platform owner experience

Verified via a full route inventory (no platform-admin test account exists in this isolated environment, and creating one requires the CLI bootstrap by design — see below):

Organizations (list/detail/suspend/reactivate), Plans/Subscriptions (assign-plan, extend-trial), Feature/limit overrides, Security events, Failed jobs (with real retryable/non-retryable retry logic), Platform health, Tenant support lookup (search), Audit log, Dashboard — every one of these is a real, reachable Platform Console API route. **The only step requiring CLI/database access is granting the very first Platform Super Admin role at all** (`scripts/bootstrapPlatformSuperAdmin.ts`) — a deliberate RC-6 security design (no HTTP route, public or authenticated, can ever grant this role), not a gap. One-time, by the business owner, before launch.

## 18 · Billing model

Real plan/capability/limit architecture: 15 gate-able feature capabilities × 9 real numeric usage metrics (seats, leads, whatsapp_messages, whatsapp_campaign_sends, automation_executions, **ai_requests**, storage_bytes, integrations, webhook_deliveries). Real trial support. Real hard-limit enforcement (`EntitlementError("limit_exceeded")` — a clean block, never silent overage billing; simple and safe for V1). Real self-service cancellation and real platform-side suspension (RC-6-tested). Race-tested seat-limit enforcement (RC-3/RC-9).

**Gap**: self-service plan upgrade/downgrade has a real, safe backend route (`POST /api/admin/billing/subscription/assign-plan`) but **no frontend UI anywhere** — a plan change today requires the platform owner acting through the Platform Console, not the customer themselves.

**Zero real commercial plans exist in any environment right now** — every organization runs on the internal fallback. The platform owner can create real priced plans through the product's own admin UI (`POST /api/admin/billing/plans`) — no code required, a pure BEFORE FIRST CUSTOMER operational task.

No test/demo plan is exposed to customers (confirmed already fixed, §2).

## 19 · Backup / DR

`DR_RUNBOOK.md` (RC-5) already draws exactly the distinction this mission asks for, in its own words, unprompted:

- **Atlas M10+ with Cloud Backup**: RPO minutes (PITR), RTO 30-60 min — **not yet provisioned anywhere**.
- **Atlas M0/M2/M5 shared tier (no Cloud Backup)**: RPO **undefined — as stale as the last manual mongodump**, explicitly flagged in the runbook itself as "a real, material V1 risk."
- **Local `mongodump` operator cron (this repo's own real, working tooling — re-verified this session, RC-9 F-23)**: a genuine, useful floor beneath whatever Atlas provides, but explicitly, in the runbook's own words, **not a substitute** for managed Atlas Cloud Backup.
- Encryption keys are explicitly documented as **zero-loss-tolerance** — losing one is permanent, unrecoverable data loss for everything it encrypts.
- The runbook's own bottom line, unchanged and independently reconfirmed still true this pass: **"production MongoDB must run on an Atlas tier with Cloud Backup (M10+) before this app holds real customer data — the M0/free-tier gap is the single highest-severity item in this document."** No production Atlas cluster of any tier currently exists — this remains fully open.

## 20 · Observability

Real structured JSON logging on every request. A genuinely valuable, real, TENANT-scoped Reliability dashboard (queue depth, DLQ, failure rate, retry rate, per-job detail) — a fresh, positive discovery this pass, available to every tenant admin, not just the platform owner. Real platform-wide health endpoint plus public `/api/health`/`/api/health/ready` for external uptime-monitor integration. `ERROR_TRACKING_PROVIDER` is a real, vendor-neutral webhook-POST mechanism, correctly degrading to stdout-only logging when unset. **External accounts still required**: an uptime monitor pinging `/api/health/ready` (any free-tier service works, nothing built into this app), a real `ERROR_TRACKING_WEBHOOK_URL` target (a custom collector, an incident tool's Events API, or even a Slack webhook all work).

## 21 · Cost / paid infrastructure checklist

| Service | Classification |
|---|---|
| Web + serverless hosting (Vercel) | PAID LIKELY REQUIRED (Hobby-tier cron limits are restrictive) |
| MongoDB (Atlas) | **PAID REQUIRED** — M0/M2/M5 have no automated backup |
| Redis / separate queue | NOT NEEDED |
| File storage (S3 or Cloudinary) | DEPENDS ON VOLUME |
| Email (Postmark) | PAID REQUIRED beyond a small free/trial allowance |
| WhatsApp (Meta) | EXTERNAL PROVIDER FEES (Meta's own per-conversation pricing) |
| AI (OpenAI/Anthropic/Gemini) | DEPENDS ON VOLUME, EXTERNAL PROVIDER FEES |
| Payments (Razorpay/Stripe/Cashfree) | EXTERNAL PROVIDER FEES (per-transaction, no upfront cost) |
| Error tracking / uptime monitoring | FREE TIER LIKELY ACCEPTABLE |
| Domain + DNS | PAID REQUIRED (small annual cost) |

## 22 · Manual operations

| Operation | Requires | Acceptable for V1? |
|---|---|---|
| Grant the first Platform Super Admin | CLI (deliberate, by design) | YES |
| Provision Atlas / S3 / Postmark / Meta App / OAuth apps / domain | External provider dashboards | YES, expected |
| Set env vars on the hosting platform | Vercel dashboard | YES, expected |
| Create the first real commercial Plan(s) | Product's own UI | YES, genuinely self-service |
| Change an existing customer's plan | Platform Console (no tenant self-service UI yet) | CONDITIONAL — fine for a handful of early, personally-managed customers; doesn't scale |
| Recover a fully-locked-out user (self-service paths genuinely exhausted) | Direct database access — no product tool exists | CONDITIONAL — narrow edge case today |
| Backup restore drill | CLI, deliberate hard safety rails | YES, by design |
| Sync indexes after a schema change | CLI, documented deploy step | YES, expected |

## 23 · Security residual risk register

See the full table compiled during this audit (findings below carried into the scorecard/verdict). Headline items, most severe first:

1. **No production MongoDB Atlas cluster (or equivalent managed, backed-up database) provisioned** — HIGH operational/DR risk (not an application vulnerability); total, unrecoverable data-loss exposure if real customer data were ever put on the current unmanaged local database. **Launch blocking.**
2. **Terms of Service / Privacy Policy pages return live 404s**, yet the real signup form's consent checkbox references both — MEDIUM business/compliance risk. **Recommend launch blocking** (compliance, not code — needs real legal authorship, not fabricated by this audit).
3. Conversations RBAC gap — LOW security risk, but a real functional limitation for the core lead-communication workflow. Not launch blocking in the strict security sense; functionally significant.
4. No self-service plan-upgrade UI, no admin-assisted account recovery, no key-rotation tooling — all LOW, all non-blocking, all narrow or low-frequency in practice, all already mitigated by an existing safe fallback.
5. F-12/F-16 (RC-9, LOW) — confirmed not real product defects / not proven bottlenecks. No action.
6. 123 uncommitted git changes — LOW, purely operational; nothing to deploy until committed.

No LOW finding was hidden or omitted.

## 24 · Legal / customer-facing requirements

`/privacy` and `/terms` both return real, live 404s — the self-service registration form's own consent checkbox ("I agree to the Terms of Service and Privacy Policy") links to both. A genuine, concrete gap requiring business/legal authorship — the consent mechanism and links are correctly built, only the actual page content is missing. **No legal content was written or implied as reviewed by this audit**, per the mission's own explicit instruction. A real support contact channel exists (`/contact`, 200 OK, plus a real footer email `hello@learnsynaptic.com`). No billing/refund-policy page exists yet — needed before real money changes hands. No cookie-disclosure banner — likely acceptable for a session-cookie-only auth model with currently-unconfigured analytics, worth a business/legal call once analytics are enabled in production.

## 25 · Real customer data safety

Clean sweep, no issues found: no auto-seeding on build/startup (`next build`/`next start` are unmodified, no hidden seed hook); the only seed-shaped script is explicit, CLI-only, never auto-invoked; zero debug endpoints (the two routes matching "test" are legitimate, authenticated product features — test-webhook-delivery and test-notification); zero unsafe secret logging anywhere in production code; `scripts/createAdminUser.ts` is genuinely CLI-only, never auto-invoked from any route or startup hook; no production secrets committed to git; no demo/test plan visible to customers. Every test organization/lead/credential/message referenced anywhere in RC-9/RC-10 exists only in this session's own isolated local MongoDB instance — never in any shared or production system.

## 26 · Release configuration

**BEFORE DEPLOYMENT**
- Commit and push the current working tree (123 uncommitted changes spanning RC-5 through RC-9's real work).
- Provision a real MongoDB Atlas cluster, M10+ tier, with Cloud Backup (and PITR if the tier supports it) enabled. Migrate/point `MONGODB_URI` at it.
- Register a real production domain; point it at the deployment.
- Set every `[REQUIRED]` environment variable per §14 to a real, production-unique value (never copied from any test/staging value) — `lib/startupValidation.ts` will loudly flag anything missed at real production boot.
- Set `STORAGE_PROVIDER=aws_s3` or `cloudinary` with real credentials (never `local` in production).

**AFTER DEPLOYMENT**
- Verify `GET /api/health` and `/api/health/ready` both report healthy against the real production database.
- Register OAuth callback URLs (social login + Calendar connectors, whichever are used) in each vendor's own dashboard against the real production domain.
- Configure email-sending DNS (SPF/DKIM/DMARC) via Postmark's own domain-verification flow.
- Point `ERROR_TRACKING_WEBHOOK_URL` at a real external collector; set up an external uptime monitor against `/api/health/ready`.
- Run the CLI bootstrap for the first real Platform Super Admin account.
- Run a real backup-restore drill (`npm run db:verify-backup`) against the newly-provisioned Atlas cluster to confirm this app's own schema/indexes restore usably, not just that Atlas's own snapshot mechanism works.

**BEFORE FIRST CUSTOMER**
- Author real Privacy Policy / Terms of Service content (business/legal review) and wire the existing `/privacy`/`/terms` routes to it.
- Create at least one real, priced commercial Plan through the product's own admin UI.
- Configure whichever of WhatsApp / Email / AI / Payments the first customer actually needs (per §5-8), including any real vendor approval steps (Meta Business Verification, etc.) that have their own lead time.
- Decide how to handle the Conversations RBAC gap if the first customer's team includes non-Admin staff who need to message leads directly (either accept Admin-only as a known V1 limitation for that customer, or treat it as a pre-launch fix — a real product decision, not made by this audit).

**AFTER FIRST CUSTOMER ONBOARDS**
- Monitor the Reliability dashboard and `/api/health/ready` regularly.
- Plan the self-service plan-upgrade UI and admin-assisted account-recovery tooling once manual, owner-mediated handling of these no longer scales.
- Revisit encryption-key rotation tooling only if a real key-compromise incident response plan becomes necessary.

## 27 · Fix policy

**Zero code changes were made during RC-10.** Every item found was evaluated against the mission's own bar ("clearly release blocking, small and bounded, proven, low regression risk") and none qualified: the two genuinely release-blocking defects (F-11, F-19) were already fixed and retested in RC-9; every gap newly identified this pass is either genuine feature work too large for a bounded fix (Conversations RBAC, self-service billing UI, admin account recovery, key rotation), not a code defect at all (infrastructure provisioning, git hygiene, legal content), or non-blocking and cosmetic (the AI-usage-metric Billing UI gap). This is the correct, honest outcome for an audit/launch-gate pass sitting on top of a codebase whose real release-blocking defects were already resolved in the prior pass.

## 28 · Final regression

Re-run after confirming zero application code was modified during this pass (only new files under `scripts/rc9/`, RC-10's own verification scripts, were added):

- `npx tsc --noEmit` — clean.
- `npx vitest run` — **834/834 passing across 94 files**.
- `npx next build` — clean, exit 0.
- Auth/RBAC/tenant/queue/platform: reconfirmed via fresh live spot-checks this session (§1), all correct.

## 29 · Final integration matrix

| Capability | Code Complete? | Configured? | Credentials Present? | Live Verified? | Customer Action? | Provider Action? | Launch Blocking? |
|---|---|---|---|---|---|---|---|
| CRM (Leads/Tasks/Pipeline/Opportunities) | Yes | Yes | N/A | Yes (extensive) | No | No | No |
| WhatsApp (Meta Cloud API + Embedded Signup) | Yes | No | No | No (sandbox/console only) | Tenant self-connect via Embedded Signup | Meta App + WABA + Business Verification | No (feature-dependent on customer) |
| Email (Postmark) | Yes | No | No | No (console fallback only) | No | Postmark account + domain verification | No (feature-dependent) |
| Automation (Workflows) | Yes | Yes | N/A | Yes (real cron confirmed) | No | No | No |
| AI (OpenAI/Anthropic/Gemini) | Yes | No | No | No (graceful "unavailable" confirmed) | No | API key only | No (feature-dependent) |
| Payments (Razorpay/Stripe/Cashfree) | Yes | No | No | Sandbox-shaped only, never live money | No | Vendor account + webhook registration | No (feature-dependent, blocking if paid plans are needed at launch) |
| Storage (S3/Cloudinary) | Yes | No (local active) | No | Yes (local, dev-only) | No | Bucket/account + credentials | **Yes if serverless-deployed with real uploads expected** |
| Calendar (Google/Microsoft/Zoom) | Yes | No | No | No | Tenant "Connect" | OAuth app registration | No (feature-dependent) |
| Team Notifications (Slack/Teams/Discord webhooks) | Yes | No | N/A (tenant-supplied URL) | Tested against non-live URLs (RC-9) | Tenant supplies own webhook URL | None | No |
| Analytics / Executive Dashboard | Yes | Yes | N/A | Yes | No | No | No |
| Billing (plans/subscriptions/usage/entitlements) | Yes (backend) | **No real commercial plan exists** | N/A | Yes (mechanics tested) | **No self-service upgrade UI** | Owner creates real plan(s) | **Yes — no priced plan exists yet** |
| Backups (RC-5 tooling) | Yes | **No managed production backup provisioned** | N/A | Yes (local drill, this pass) | No | **Atlas Cloud Backup enablement** | **Yes** |
| Observability | Yes | Partial (stdout-only until configured) | N/A | Yes (Reliability dashboard, health endpoints) | No | External error-tracker + uptime monitor | No |
| Database (MongoDB) | Yes | **No** | N/A | N/A (local test only) | No | **Atlas cluster provisioning** | **Yes** |
| Queue/Cron | Yes | Yes (`vercel.json`) | Yes (needs `CRON_SECRET`) | Yes | No | Vercel plan tier | No |

## 30 · Final V1.0 scorecard

Scored separately, no hidden average:

| Dimension | Score | Basis |
|---|---|---|
| Product completeness | 95/100 | Full 35-module blueprint + RC-1–9 shipped; the only real functional gaps are Conversations RBAC scope and the missing self-service billing UI |
| Security | 98/100 | 0 open Critical/High/Medium; every credential class encrypted at rest with real auth-tag verification; CSRF/auth/RBAC/platform boundaries independently reconfirmed live this pass |
| Tenant isolation | 98/100 | Both CRITICAL cross-tenant defects found and fixed in RC-9, independently reconfirmed clean this pass via live test + direct DB query |
| Reliability | 95/100 | Real DLQ/retry/idempotency architecture, extensively load- and failure-tested in RC-9; genuinely simplified (no separate queue service to fail) |
| Performance | 90/100 | RC-9's own benchmarks clean at real seeded scale; no load testing has ever been performed against a real production-tier database or hosting plan |
| Authentication | 98/100 | See §15 — explicit YES, with extensive evidence |
| WhatsApp | 85/100 (code) / 0/100 (live) | Code and Embedded Signup flow complete; zero real vendor verification has ever occurred (correctly, given no real Meta account exists) |
| Automation | 95/100 | Real, self-service, genuinely cron-driven; one real seed-data test-fixture issue disclosed, not a product bug |
| Integrations (Calendar/Storage/Notifications) | 90/100 | All real, code-complete; none configured against a live vendor anywhere |
| Billing | 75/100 | Backend genuinely solid and race-tested; no real commercial plan exists yet, no self-service upgrade UI |
| SaaS operations (Platform Console) | 95/100 | Full route coverage for every operator capability the mission names; only the initial bootstrap needs CLI, by design |
| Backup/DR | 60/100 | Local tooling genuinely real and re-verified; **zero managed production backup provisioned** — the runbook's own words, "the single highest-severity item in this document," independently reconfirmed |
| Observability | 80/100 | Real logging/health/Reliability-dashboard infrastructure; no external error-tracker or uptime monitor connected yet (expected pre-launch, not a code gap) |
| Documentation | 95/100 | RC-8's own thorough pass, `.env.example` alone functions as a near-complete go-live reference, independently confirmed accurate this pass |
| Customer onboarding | 90/100 | Full self-service funnel proven end-to-end in a real browser; the one real funnel-blocking bug found in RC-9 (F-22) is fixed and retested |

## 31 · Final verdict

# CONDITIONAL GO

**Definition applied**: software is fundamentally ready, but specific production configuration and external-provider tasks must be completed before the first customer. This is not a software, security, or data-integrity defect — the application code itself has zero open Critical or High findings, independently reconfirmed in this pass. What remains is genuinely infrastructure provisioning, business/legal content, and a small number of feature-completeness gaps, none of which represent an unresolved code-level blocker.

**The specific conditions that must be met before GO, in priority order:**
1. Provision a real MongoDB Atlas M10+ cluster with Cloud Backup enabled and migrate to it — currently, real customer data would have no managed backup or recovery story at all.
2. Author real Privacy Policy / Terms of Service content and wire it to the already-built `/privacy`/`/terms` routes and the signup form's own consent checkbox.
3. Commit and deploy the current working tree; set every `[REQUIRED]` production environment variable to a real, unique value.
4. Create at least one real, priced commercial Plan through the product's own admin UI.
5. Configure whichever of WhatsApp/Email/AI/Payments the specific first customer actually needs, including any vendor-side approval steps with their own lead time (Meta Business Verification in particular).
6. Decide how to handle the Conversations RBAC gap for that customer's real team structure.

None of these require new application code beyond what already exists; all are configuration, provisioning, or business/legal actions.

## 32 · WHAT PRATIK NEEDS TO DO NOW

**1. What's already finished.** The product itself — CRM, WhatsApp messaging, email, AI-assisted lead scoring and replies, automation workflows, campaigns, analytics, billing logic, a full admin console, and a separate console for you to run the whole business — is built, tested, and secure. A complete security and load-testing pass (RC-9) found and fixed two serious bugs (both about one customer accidentally seeing another customer's data) — both are fixed and re-verified. Every automated check (currently 834 tests) passes.

**2. What you need to purchase/configure before going live.**
- A real MongoDB database plan (MongoDB Atlas, at least their "M10" tier, with backups turned on) — this is the single most important thing on this list. Right now there is no real, backed-up database anywhere.
- A domain name for the app.
- A Vercel hosting plan (their free tier's scheduling limits are too restrictive for this app's real needs).
- An email-sending account (Postmark) once you want real emails to go out.
- A file-storage account (Amazon S3 or Cloudinary) once customers start uploading files.

**3. Which API keys/credentials you need**, and only once you're ready for that specific feature: a Meta (WhatsApp) developer account and app; an OpenAI, Anthropic, or Google (Gemini) API key for AI features; a Razorpay, Stripe, or Cashfree account for payments. None of these are needed to launch — only needed once you turn that specific feature on for real customers.

**4. Which provider dashboards you need to configure.** For each service above, you'll register your real domain's callback/webhook URLs in that provider's own dashboard (Meta, your email provider, your payment provider). This is a one-time setup per provider.

**5. What customers configure themselves.** Once your Meta app is live, a customer can connect their OWN WhatsApp Business number through a self-service popup — you never touch their credentials. Same for calendar connections. They cannot yet upgrade their own subscription plan through the app — see #7.

**6. What is automatic after configuration.** Once the pieces above are set up, day-to-day operation is automatic: campaigns send on schedule, automations run every 5 minutes without anyone clicking anything, usage limits enforce themselves, and every customer only ever sees their own data.

**7. What still requires you manually, at least for now.**
- Changing an existing customer's subscription plan (there's no "upgrade" button for them yet — you'd do it from your own console).
- Helping a user who's completely locked out of their account (lost their password AND their two-factor device AND their backup codes) — an extremely rare case, but there's no built-in tool for it yet.
- Writing your actual Privacy Policy and Terms of Service — I cannot write these for you; they need real legal review.

**8. Can you onboard a real customer? Not safely, not yet — but you're very close.** The product itself is ready. What's missing is entirely on the "running a real business" side: a real backed-up database, real legal pages, and picking which paid features (WhatsApp/email/AI/payments) your first customer actually needs.

**9. Exact launch sequence.**
1. Set up the real MongoDB Atlas database (with backups on) and point the app at it.
2. Get a domain, deploy the app to it.
3. Get your Privacy Policy and Terms of Service written and published.
4. Create your first real, priced plan inside the app's own admin screen.
5. Turn on whichever of WhatsApp/Email/AI/Payments your first customer actually needs (this can be done gradually — you don't need all four on day one).
6. Create your own Platform Super Admin login (one command, given to you by this project's own setup scripts).
7. Invite your first real customer to sign up.

## 33 · API activation answer

"If I add all required API keys and credentials, will the respective features automatically start working?"

| Integration | Answer | What additional configuration, if any |
|---|---|---|
| WhatsApp (Meta) | **YES, AFTER ADDITIONAL CONFIGURATION** | Needs a real Meta App + Business Portfolio + WABA registered in Meta's own dashboard first — the API key alone isn't sufficient, Meta's own approval/verification process sits in between. |
| Email (Postmark) | **YES, AFTER ADDITIONAL CONFIGURATION** | Needs a verified sending domain with SPF/DKIM/DMARC DNS records — the API token alone will work for a Postmark sandbox but not real deliverability to customer inboxes. |
| AI (OpenAI/Anthropic/Gemini) | **YES** | Genuinely just the API key — no other configuration needed, the simplest of all integrations. |
| Payments (Razorpay/Stripe/Cashfree) | **YES, AFTER ADDITIONAL CONFIGURATION** | Needs the webhook URL + webhook secret registered in the vendor's own dashboard, and a real (not sandbox) merchant account approved by the vendor. |
| Storage (S3/Cloudinary) | **YES** | Just the credentials + bucket name — no additional configuration beyond creating the bucket/account itself. |
| Calendar (Google/Microsoft/Zoom) | **YES, AFTER ADDITIONAL CONFIGURATION** | Needs the OAuth app's redirect URI registered in that vendor's own dashboard to exactly match the real production domain. |
| Billing plan upgrades (customer self-service) | **NO, ADDITIONAL DEVELOPMENT REQUIRED** | The backend exists; the customer-facing "upgrade my plan" screen does not. Not an API-key issue at all. |

## 34 · Final audit summary

- **RC-10 status**: Complete against its own approved scope.
- **Final integration matrix**: §29.
- **Production configuration status**: no production infrastructure (database, hosting tier, domain) provisioned yet — see §26.
- **Remaining external configuration**: see §5-14, §26.
- **Remaining manual operations**: see §22.
- **Residual risks**: see §23 — 1 HIGH (no managed database backup), 1 MEDIUM (missing legal pages), several LOW, all non-blocking or already mitigated.
- **Infrastructure requirements**: see §21.
- **Security verdict**: YES, safe (§15) — independently reconfirmed, zero open Critical/High/Medium findings.
- **First-customer readiness**: functionally ready; operationally NOT yet, pending §26's BEFORE DEPLOYMENT / BEFORE FIRST CUSTOMER items.
- **Final V1.0 verdict**: **CONDITIONAL GO** (§31).

---

**STOP. Per this mission's own explicit closing instruction: do not start V2, do not propose another RC automatically. Waiting for owner review and explicit V1.0 launch approval.**

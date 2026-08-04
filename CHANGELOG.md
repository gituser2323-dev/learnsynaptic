# Changelog

This file summarizes the production modules built on top of the existing
LearnSynaptic marketing site, why each change was made, and what QA was
run before sign-off. See `ARCHITECTURE.md` for the full platform audit and
roadmap these modules are sequenced from.

---

## RC-3 — Reliability, Queues & Observability (Production Hardening Release Candidate)

**Goal:** the mission's own words — audit reliability across the scheduler/cron/automation engine/WhatsApp sending/campaigns/AI/webhooks/payments/background jobs; choose queue infrastructure based on the ACTUAL deployment architecture, not by reflex; make queued work durable, retryable, idempotent, and tenant-safe; add real observability (error tracking, structured logging, health checks, metrics); prove recovery under failure and concurrency. RC-1 (Authentication & Identity) and RC-2 (Enterprise Security Hardening) were complete before this pass began.

**Queue architecture decision, made explicit rather than assumed:** this app is deployed on Vercel serverless (`vercel.json`'s five-minute-interval cron entry hitting `/api/cron/run-due-jobs`), with an already-working MongoDB-backed job scheduler (`lib/services/scheduler/`) as its real, deployed queue. Redis/BullMQ was evaluated and deliberately NOT adopted — a BullMQ worker needs an always-running Node process to pull jobs off Redis, which this deployment has no such process for; introducing one would mean standing up separate infrastructure this deployment doesn't have, not a drop-in library swap. The existing architecture already satisfies the real requirements (persistence across restarts, retry with backoff, tenant context per job); this pass's job was hardening it, not replacing it.

**The single most severe bug found and fixed: a genuine double-execution race.** Both `ScheduledJob` and `WorkflowRun` processing used a separate find-then-update — two overlapping poller invocations (a real Vercel Cron trigger racing an admin's own "Run Due Jobs Now" click, for instance) could both see the same "pending"/"due" record and both execute it. Fixed identically for both with a new atomic `claim()` repository method (`findOneAndUpdate` with a status-conditional filter — MongoDB guarantees this read-modify-write is atomic per document), called as the first action inside each per-item processor; a null result (another invocation already claimed it) is a silent, logged no-op. This fix itself introduces a new question — what happens to a claim abandoned by a crash? — closed by widening `findDue()`/`claim()` to also reclaim a "processing" record whose `updatedAt` predates a 10-minute `STALE_CLAIM_MS` threshold, real crash/restart recovery with no heartbeat mechanism needed.

**A second, independently-discovered concurrency bug, found via deliberate concurrency testing (not code review): payment webhook idempotency had a real check-then-insert race.** `paymentService.handleProviderWebhook`'s dedup was a read (`findByProviderEventId`) followed by a write at the very end of processing — sufficient for the common sequential-retry case, but two GENUINELY CONCURRENT deliveries of the same event (a real payment-gateway behavior, not a hypothetical) could both pass that read before either finished, both call `applyPaymentOutcome`, and double-fire non-idempotent side effects (`publish("payment.success", ...)` triggering Automation twice, `registrationService.confirmRegistration` running twice, duplicate audit entries) even though the underlying `Payment` row itself only ended up in one state. Fixed with the same class of fix as the scheduler race: a real, DB-enforced unique index on `(provider, providerEventId)` — `unique: true` with a `partialFilterExpression` scoping it to only the three "a claim exists" outcomes (`processing`/`processed`/`error`), so `duplicate` log rows (expected to repeat, once per redundant delivery) never collide with each other or with the one real claim. The webhook handler now inserts a `processing` claim FIRST — a concurrent racer's own insert hits the same unique key and loses, recording `duplicate` and returning without ever calling `applyPaymentOutcome` a second time — then updates that same row in place to `processed`/`error` once side effects finish (never a second insert, which the index would itself reject). A prior `error` outcome is deliberately treated as reclaimable (a genuine vendor retry after this app's own earlier failure, not a duplicate), so a transient failure can never permanently wedge a payment. Disclosed residual gap: two simultaneous retries racing the SAME already-errored row aren't further compare-and-swap-guarded — extremely unlikely (requires both a genuine prior failure AND two simultaneous retries of it), smaller blast radius than the primary race this closes.

**Everything else built or hardened:**

1. **Outbound request timeouts.** `AbortSignal.timeout(MS)` added to every outbound `fetch` call this codebase makes — ~30 call sites across WhatsApp/Meta, AI (OpenAI/Anthropic/Gemini), Email (Postmark), Payments (Stripe/Razorpay/Cashfree), Calendar (Zoom/Google/Microsoft), Storage (Cloudinary), outbound Webhooks + notification providers (Slack/Discord/Teams), and OAuth login providers (Google/Microsoft/GitHub) — new named constants per category in `lib/net/timeouts.ts`. No external request can hang indefinitely and block a serverless function invocation. Verified generically (the shared primitive, not per-provider) against a real local server that intentionally never responds.
2. **`/api/health` split into real liveness + readiness.** The existing route is now pure liveness (process up, deliberately never touches the database — a dependency outage must never fail liveness and trigger an unnecessary restart). New `/api/health/ready` does the real dependency check: a bounded, timed MongoDB round-trip against the ScheduledJob collection (which IS this app's queue — one round-trip proves both DB and queue reachability, no separate broker to probe), returning 200/503 with `{database, queue}` status — never exposing connection strings or credentials, since this route is deliberately public (a load balancer has no admin session).
3. **DLQ admin visibility + metrics.** New `getQueueMetrics()` (queue depth, DLQ size, oldest-*overdue* pending job age, retry rate, a bounded per-jobType failure breakdown) and `listScheduledJobs`/`retryScheduledJob`/`cancelScheduledJob` wired to new admin routes (`/api/admin/jobs`, `/api/admin/jobs/metrics`, `/api/admin/jobs/[id]/retry`, `/api/admin/jobs/[id]/cancel`) and a new `/admin/reliability` page — extends the existing dashboard chrome (Table/Badge/StatCard/Pagination), never a redesign. Every job-visibility/mutation route is fail-closed tenant-scoped (a missing `organizationId` never falls through to an unfiltered cross-tenant query); retry/cancel treat a job owned by a different organization identically to "not found." Job `payload` is never returned raw (some job types embed full business-event bodies) — only `payloadKeys` (names, not values). Found and fixed live during browser verification: a self-rescheduling recurring job (`automation.tick` and similar) legitimately sits "pending" with a future `runAt` between ticks — the original "oldest pending job" query didn't exclude these, producing a nonsensical *negative* age; fixed to only consider jobs whose `runAt` is already in the past.
4. **Provider-neutral error tracking.** New `lib/services/errorTracking/` (`disabled`/`webhook` providers, same shape as the existing `virusScan` provider architecture) wired into `handleApiError`'s unhandled-error branch (the funnel for every unhandled API/application/database error) and the scheduler's terminal job-failure branch (the funnel for every background job type's terminal failure — WhatsApp sends, campaign promotion, webhook/notification delivery, billing checks — without touching each job handler individually). `disabled` (the default) still logs everything to this app's own structured logs; `webhook` POSTs a JSON event to any operator-configured collector URL — deliberately not a specific vendor's proprietary ingestion protocol, so it's never hardcoded to one observability vendor. Never throws (error-reporting infrastructure failing must never mask the original error); flagged at startup (`lib/startupValidation.ts`) as recommended-but-unconfigured in production, same tier as `MONGODB_URI`.
5. **Correlation IDs already traced end-to-end.** `withApiRoute.ts`'s per-request `requestId` was already threaded through every log line; `handleApiError` now also threads `organizationId`/`userId`/`route` through to error tracking specifically (hoisted out of its originating `try` block so it survives into the `catch`).
6. **Job/run states reused, not reinvented.** `ScheduledJobStatus` gained `processing` (the atomic-claim transient state) and `dead_lettered` (a more specific substate of `failed` — retry-eligible AND exhausted, the DLQ view's real query target); `WorkflowRunStatus` gained `processing`; `PaymentWebhookOutcome` gained `processing`. Every other value was already correct and left untouched, per the mission's own "reuse existing states, don't invent competing terminology."
7. **Failure simulation + concurrency proof, not just implementation.** New tests prove: a poison job (handler that always throws) never blocks the rest of its batch — a healthy job enqueued alongside it in the same `runDueScheduledJobs()` call still completes; concurrent poller invocations never double-process a `ScheduledJob` or `WorkflowRun` (direct claim-atomicity tests plus a full race simulation via `vi.spyOn`); a stale claim left by a crashed/restarted worker is correctly reclaimed; two genuinely concurrent payment webhook deliveries of the same event result in exactly one `processed` + one `duplicate`, with the non-idempotent side effect (confirming a linked Registration) firing exactly once; a webhook whose side effect fails is recorded `error` and a genuine retry safely reprocesses instead of being permanently dropped; cross-tenant DLQ retry/cancel/metrics are blocked (Org B can never touch Org A's jobs or see Org A's queue depth).

**Explicitly NOT done this pass, disclosed rather than silently skipped:** automation step-level failures (`WorkflowRun.status: "failed"`, 4 distinct call sites in `engine.ts`) aren't individually forwarded to the external error tracker yet — they remain visible via the existing Automation page, a smaller, disclosed v1 boundary rather than scattering the error-tracking call across every failure branch in this pass. Alerting extension points (queue backlog, DLQ growth, provider-failure-spike thresholds) reuse the existing Team Notifications/webhook architecture's *delivery mechanism* but no new threshold-crossing triggers were added — the metrics they'd key off (`getQueueMetrics()`) now exist, wiring actual alert rules on top is a natural next-RC follow-up. Full RC-9-scale load testing was explicitly out of scope per the mission's own instruction; this pass proved correctness under real concurrency (2–3 simultaneous actors), not throughput at scale.

**Testing — 32 new unit tests (702 total, up from 670) and 2 new Playwright E2E specs (131 total, up from 129).** Full regression: 702/702 unit tests, `npx tsc --noEmit` clean, full production build succeeding, project-wide ESLint clean on every file this pass touched (the same 14 pre-existing errors in unrelated marketing-site UI components/old test fixtures from RC-2's own disclosure remain, untouched, out of scope). E2E: 130/131 passing — the one failure (`crm-settings.spec.ts`'s Assignment Rule panel test) is confirmed pre-existing flakiness unrelated to this pass (passes cleanly in isolation; the same file/panel, untouched by RC-3). Live browser verification against a real MongoDB-backed dev server: logged in as a real admin, exercised `/api/health` and `/api/health/ready` directly, and the new `/admin/reliability` page end-to-end — metrics, filters, pagination, and a real "Cancel" action against a live pending job, which correctly updated both the table and the metrics on reload.

**Deployment infrastructure required for production readiness:** none beyond what RC-1/RC-2 already required — this pass deliberately did not introduce a dependency on infrastructure this deployment doesn't have (see the queue-architecture decision above). `ERROR_TRACKING_PROVIDER=webhook` + `ERROR_TRACKING_WEBHOOK_URL` are newly available but optional (default `disabled` degrades to structured-log-only, never a startup failure).

**RC-3 (Reliability, Queues & Observability) is complete against its own approved scope.** Per this pass's own explicit instruction, RC-4 was not started.

---

## RC-2 — Enterprise Security Hardening (Production Hardening Release Candidate)

**Goal:** the mission's own words — a complete security audit across authentication, authorization, RBAC, tenant isolation, middleware, APIs, webhooks, file uploads, integrations, payments, AI APIs, WhatsApp, the scheduler, automation, background jobs, cookies, JWT, sessions, CSP, security headers, rate limiting, environment variables, secrets, logging, and audit logs — then strengthen every real gap found. Explicitly scoped as a hardening pass: audit first, extend only where required, never rewrite a working system. RC-1 (Authentication & Identity) was complete before this pass began; RC-3 was not started, per the mission's own explicit instruction.

**The audit itself found this codebase already in genuinely strong shape** — RC-1 and the five Phase-8 multi-tenant modules had already built real signature verification on every webhook (WhatsApp HMAC, Postmark shared-token constant-time comparison, payment-provider signatures), a real SSRF floor on outbound webhook URLs, magic-byte upload validation, a real path-traversal defense in local file storage, pinned JWT algorithms, sameSite cookies, and an extensive existing pentest-style test suite from RC-1 and Module 8.1's own Cross-Tenant Attack Suite. This pass's job was finding what was still missing, not rebuilding what already worked — reflected below in how much of it is targeted, additive hardening rather than architectural change.

**Nine real, previously-unaddressed gaps were found and fixed:**

1. **No global request-size ceiling.** Every route read its full request body into memory via `request.json()`/`request.formData()` with no size check at all — a multi-hundred-MB body could exhaust memory/CPU before any rate limit even applied. Fixed with a 60MB `Content-Length`-based ceiling in `withApiRoute.ts` (generous enough to never reject a real upload — the largest legitimate category, VIDEO/EXPORT, is 50MB), plus a tighter, JSON-specific 2MB cap in `parseJsonBody()` (no legitimate JSON payload in this app — a lead, a campaign config — ever approaches that size). New `PayloadTooLargeApiError` (413). Disclosed limitation: a request that lies about its own `Content-Length` isn't caught at this layer alone — a real deployment's reverse proxy/platform already enforces its own hard ceiling independently, the same "defense in depth, not the only layer" posture `inMemoryRateLimiter`'s own doc comment already takes for its per-process limitation.
2. **"Login CSRF."** Every authenticated write in this app relies on `sameSite=lax` cookies for CSRF protection — but `/api/auth/login` runs BEFORE any session cookie exists, so that mitigation provides zero protection for the one endpoint where a forged cross-site POST could log a victim's browser into an ATTACKER'S OWN account (using the attacker's own known credentials), a real, named attack class. Fixed by applying the same `isSameOriginRequest()` check `/api/leads`/`/api/registrations` already used for their own anonymous-write surface.
3. **No virus-scanning hook existed at all**, despite file uploads (documents, CRM attachments, WhatsApp media) being a real, standing feature. Built a full pluggable `VirusScanProvider` architecture (`lib/services/storage/virusScan/`) matching this codebase's own established vendor-provider pattern (Email/WhatsApp/AI/Storage): a real, protocol-correct ClamAV `clamd` adapter (hand-rolled INSTREAM wire protocol — no SDK exists for a local daemon — verified against a real local TCP server in tests, not mocked, though no live `clamd` exists in this environment to verify against, the same disclosed-honesty posture `CloudinaryStorageProvider`'s own unverified private-URL signing already takes) and a safe, explicit `"disabled"` default (uploads still work with zero config, logging one loud warning per process rather than failing silently). Wired into `fileStorageService.uploadFile()`, fails CLOSED on both "infected" and "scanner unreachable."
4. **File downloads had no `Content-Disposition` at all** — the local-storage delivery route always served `application/octet-stream` with no filename, and S3 signed URLs never set `ResponseContentDisposition`, meaning a browser's own content-sniffing behavior (not this app's Content-Type) decided whether an uploaded HTML/SVG file rendered inline (a real stored-XSS-via-upload vector) or downloaded. Fixed with a real RFC 6266/5987 `filename`+`filename*` header builder (`buildContentDispositionHeader`) forcing `attachment` disposition everywhere, threaded through a new `StorageDownloadOptions` on `StorageProvider.getSignedUrl()`. This surfaced a second, real bug along the way: `FileAsset.originalFilename` is stored RAW/unsanitized (by design — it's a display value), which would have been a genuine header-injection vector if interpolated directly into the new header; the builder uses percent-encoding rather than hand-rolled quote-escaping specifically to close that off completely, not just for the inputs tested.
5. **The webhook-endpoint SSRF guard only blocked loopback/metadata-IP hostnames**, not the three real RFC 1918 private ranges (10/8, 172.16/12, 192.168/16) or IPv6 unique-local/link-local ranges — an admin-registered webhook (already a privileged action, but a realistic "compromised admin account" threat model this app's own tenant-isolation work already takes seriously elsewhere) could still target another service on a shared private network. Extended `BLOCKED_HOSTNAME_PATTERNS` to cover all of them, with boundary tests proving real public IPs just outside those ranges are never falsely rejected.
6. **Six real encryption/signing secrets each silently fell back to a dev-only, checked-into-source value in production**, with no startup-time warning — an operator would only discover the gap the first time the specific feature was used (MFA setup, an OAuth login, a tenant credential save), often days after a real deploy. Built `lib/startupValidation.ts` + `instrumentation.ts` (Next.js's own supported once-at-process-start hook, newly adopted by this app) — a centralized, production-only check that logs a loud `error`-level warning for each of the six if unset (never throws — matches every one of those six config files' own existing "insecure but still starts" posture, not a new fail-closed behavior this pass didn't earn the right to introduce) plus a quieter `warn` for three already-fail-closed-but-easy-to-misdiagnose vars (`CRON_SECRET`, `PLATFORM_ADMIN_SECRET`, `MONGODB_URI`).
7. **Dependency audit: 5 real CVEs (4 high, 1 moderate)** — `brace-expansion` (DoS via unbounded expansion), `postcss` (XSS in CSS stringify output + two arbitrary-file-read advisories via sourceMappingURL), `sharp`/libvips (4 CVEs inherited from the underlying image library `next/image` uses at runtime). All fixed via `npm audit fix` — every upgrade fully semver-compatible (Next.js 16.2.11→16.3.0, sharp 0.34→0.35, no major-version bumps), full regression suite re-run clean afterward. `npm audit`: 0 vulnerabilities.
8. **Security headers**: `Permissions-Policy` expanded from 3 denied APIs to 18 (every one grepped for a real caller first — only `clipboard-write` has one, Security Settings' own "copy recovery codes" button, and is the one explicitly allowed); added `Cross-Origin-Opener-Policy: same-origin-allow-popups` (real `window.opener`/"tabnabbing" protection, deliberately the permissive-with-popups variant so it doesn't break WhatsApp Embedded Signup's own Facebook Login popup flow), `X-Permitted-Cross-Domain-Policies: none`, `X-DNS-Prefetch-Control: off`. CSP's own pre-existing `'unsafe-inline'` script-src limitation (disclosed in RC-1) is unchanged — a nonce-based rewrite is real, invasive surgery across every page render this pass's own "don't rewrite working systems" scope doesn't license without a dedicated pass. Live-verified in a real browser against a real production build: zero console errors/CSP violations on both an admin page and the marketing homepage (which actually loads GA4/Meta Pixel — the real CSP stress test), screenshotted to confirm normal rendering.
9. **Two pre-existing, unrelated TypeScript errors** (in WhatsApp campaign/conversation test fixtures — a missing required `timestamp` field, an `it.each` callback arity mismatch) were surfaced as REAL production-build failures by the Next.js 16.3.0 upgrade in fix #7 above (the previous Next.js version's build-time type-checker had tolerated them). Fixed directly — small, mechanical, in test fixture data only — since a passing production build is this pass's own required quality gate and the upgrade that exposed them was this pass's own change.

**Testing — 53 new unit tests** (670 total, up from 617) and **3 new Playwright E2E specs** (129 total, up from 126), covering real penetration-test scenarios named in the mission itself: JWT Tampering (a dedicated new suite for `tokens.ts`, previously untested despite being "the sole place authentication happens" — algorithm confusion via `alg:none` and HS384-with-the-app's-own-real-secret, forged secrets, tampered payload/subject claims, missing/invalid claims, expiry, malformed input), Rate-Limit Bypass (`inMemoryRateLimiter` and `withApiRoute`'s own integration, both previously untested despite backing every one of this app's ~150 routes — independent per-key budgets, window resets, end-to-end 429s), SSRF (the RFC 1918 extension above), Header Injection (CRLF/quote-breakout attempts against the new `Content-Disposition` builder), Login CSRF (a new E2E spec using Playwright's raw HTTP `request` fixture specifically because a real browser's own same-origin behavior can't simulate the forged-cross-site-request attacker model), and Insecure Defaults (the startup validator's own loud-vs-quiet distinction). NoSQL injection and command injection were audited (not newly tested): confirmed no `$where`/`eval` usage anywhere in `lib/db`, and confirmed the established `typeof x === "string"` coercion discipline already applied consistently across every validator (`validateLoginCredentials`, leads, registrations) already defeats the classic "pass an object instead of a string" NoSQL-injection pattern — genuinely already safe, not merely untested.

**Full regression: 670/670 unit tests, 129/129 E2E specs, `npx tsc --noEmit` clean, full production build succeeding (including live browser verification of the new headers), `npm audit` 0 vulnerabilities.** ESLint: every file this pass touched is clean (`--max-warnings=0`); the project-wide `npm run lint` still fails on 14 pre-existing errors in unrelated marketing-site UI components and old test files (React Compiler `set-state-in-effect` violations, an unescaped apostrophe, unused vars) that predate this pass and are outside "Enterprise Security Hardening" scope — disclosed here rather than silently left out of the report, not fixed (fixing them would mean editing six files with zero security relevance, the exact scope-creep this pass's own "do NOT rewrite working systems" instruction rules out).

**Remaining, disclosed risks for a future RC pass:** CSP's `script-src 'unsafe-inline'` (a real, larger nonce-based rewrite, not attempted here); secret ROTATION readiness is partial — rotating `JWT_ACCESS_TOKEN_SECRET` correctly invalidates all sessions (expected), but rotating any of the six encryption-at-rest secrets would make previously-encrypted data unreadable, since none of them support key-versioning/dual-key decryption (a real feature, not a bug fix, appropriately out of this pass's scope); the `Content-Length`-based size-limit bypass via a lying/chunked request (disclosed above); ClamAV's own real wire-protocol correctness is unverified against a live daemon (protocol implemented directly from ClamAV's own documentation, proven via a real local TCP server in tests, but not against the real thing).

**RC-2 (Enterprise Security Hardening) is complete against its own approved scope.** Per this pass's own explicit instruction, RC-3 was not started.

---

## RC-1 — Authentication & Identity (Production Hardening Release Candidate)

**Goal:** the mission's own words — transform the existing authentication system into an enterprise SaaS authentication platform, extending (never rewriting) what Module 9/RC-1-stabilization already shipped. All 9 Blueprint phases (0–8, including Phase 8's five Multi-Tenant SaaS modules) were complete before this pass began; this is the first Production Hardening Release Candidate module, explicitly scoped to authentication/identity only — no new business features, no V2 work.

**Audited the entire existing auth stack before writing any code**, per the mission's own explicit instruction, using the codebase as truth: JWT signing/verification (`tokens.ts`, jose/HS256, Edge-safe), the trusted `x-auth-*` header pattern (`middleware.ts` + `roles.ts`), refresh-token rotation with reuse detection, bcrypt password hashing, the `User`/`RefreshTokenRecord` data model, RBAC (`requiredRole`), tenant context, and the pre-existing security response headers (CSP/HSTS/etc., already comprehensive). Reused every one of these; extended in place rather than duplicating.

**Built, in order:** self-service password reset (forgot/reset/change, all session-revoking where appropriate) and email verification, both via a shared opaque-token primitive (`opaqueToken.ts`) extracted from the existing refresh-token crypto; per-account brute-force lockout (distinct from the pre-existing per-IP rate limiter) with new-device detection and notification email; "Remember Me" as a variable refresh-token TTL carried correctly through rotation; a full session-management API (list/revoke/revoke-others) and Login History (reusing the pre-existing `securityAuditLogService`, now enriched with IP/device metadata); Multi-Factor Authentication — real RFC 6238 TOTP implemented from scratch (`totp.ts`, verified against the RFC's own published Appendix B test vectors, not just self-consistency), single-use hashed recovery codes, an email-OTP fallback, and revocable 30-day trusted-device grants; and Social Login (Google + Microsoft real, GitHub as the mission's named "optional" third provider) via a provider-registry architecture (`lib/services/auth/oauth/`) mirroring the pre-existing Calendar & Meeting Connectors' own OAuth adapter pattern.

**Social Login is deliberately closed-world.** LearnSynaptic has no public self-registration route — staff accounts are admin-provisioned out-of-band — so a "login" OAuth callback never auto-creates a User, and never auto-links an OAuthAccount to an existing User by matching email addresses (a real, well-documented account-takeover vector: it would mean trusting a provider's own "verified email" claim, which Microsoft Graph's `/me` doesn't even assert). Linking only ever happens through an explicit, already-authenticated "connect this provider" action from Security Settings — the OAuth `state` param carries a signed `login`-vs-`link` intent (`oauth/state.ts`) rather than two separate flows. A genuinely new problem this raised — an MFA-enabled user signing in via a federated provider has no password-resubmission request to attach an MFA code to the way a normal login retry does — is solved with a short-lived, provider-bound, stateless signed "pending" token (`oauth/mfaPending.ts`) redeemed against a real MFA code before any session is issued, closing what would otherwise have been a real MFA bypass path for the one login method this module added.

**Two real, previously-shipped-and-live bugs were found during this pass's own security review and fixed, not shipped as known gaps:**

- **A live authentication bypass on most of the RC-1 API surface just added.** `middleware.ts`'s matcher only covered `/api/admin/:path*` and the single pre-existing `/api/auth/me`; every other new `requiredRole`-gated route this module built (change-password, sessions, login-history, every `mfa/*` route) never had its `x-auth-*` headers verified-or-stripped by middleware at all, since middleware simply never ran on those paths. `withApiRoute`'s own `requiredRole` check trusts those headers unconditionally — meaning a request could set `x-auth-user-id`/`x-auth-role` directly and be trusted with zero real session. Fixed by adding every one of those routes explicitly to the matcher (Next.js matcher config has no regex-exclude, so this is a deliberate, commented allowlist — the same style `/api/auth/me` already established), leaving only the genuinely public routes (login, refresh, forgot-password, reset-password, verify-email, the pre-login MFA email-OTP trigger, and the OAuth authorize/callback routes) outside it.
- **New public pages redirected unauthenticated visitors straight back to login.** `/admin/forgot-password`, `/admin/reset-password`, and `/admin/verify-email` are real, unauthenticated-by-design pages, but `middleware.ts`'s own page-redirect logic only exempted `/admin/login` — an E2E smoke test written for these pages caught it immediately (every one of them redirected to `/admin/login?from=...` for a session-less visitor, exactly the broken behavior a real user clicking a password-reset email link would have hit). Fixed with an explicit `OTHER_PUBLIC_PAGE_PATHS` exemption set, deliberately NOT redirecting an already-authenticated visitor away the way `/admin/login` does (a logged-in user legitimately might still open a reset/verification link from their inbox).

A third, narrower issue was also caught and fixed before shipping: extending `/api/auth/me` to return `mfaEnabled`/`emailVerified` initially made the route 401 whenever the JWT's subject had no backing `User` row — which is exactly the technique this app's own 23 existing E2E spec files use (a signed test JWT for a synthetic id, since there's no cross-process way to seed a real user into the webServer's in-memory store). Fixed to degrade gracefully (best-effort DB lookup, never failing the whole request) after the full 120-spec E2E suite was run specifically to catch this class of regression.

**Admin UI — one new page, three new standalone pages, the login page extended in place:** `/admin/settings/security` (Password, Two-Factor Authentication with QR-code setup/recovery-codes/trusted-devices, Active Sessions, Connected Accounts, Login History — a new nav entry visible to every role, not gated like the org-wide Settings page it sits beside); `/admin/forgot-password`, `/admin/reset-password`, `/admin/verify-email` (new, unauthenticated pages); `/admin/login` extended with an MFA code-entry step (resubmitting to the same `/api/auth/login`, never a separate "step 2" endpoint), Social Login buttons (rendered only for vendors `listOAuthProviders()` reports actually configured), a lockout message, and the OAuth-login MFA pending-token step.

**Testing — 94 new unit tests** (617 total, up from 523) covering real RFC 6238 known-answer vectors (not just self-consistency), and explicit penetration-test-style scenarios named in the mission itself: Replay (password-reset/email-verification/recovery-code/email-OTP tokens each redeemable exactly once), Brute Force (lockout after the configured threshold, correct password still rejected until the window expires), MFA Bypass (both the password-login gate and the new OAuth-login gate), Session Hijacking (password reset revokes every session; change-password revokes every *other* session but preserves the caller's own), Cross-Account access (session revocation, trusted-device revocation, OAuth account unlinking, and OAuth account linking are all ownership-checked — verified as real 404/rejection, not just documented), Expired Tokens, and OAuth state/pending-token tampering (provider substitution, intent escalation, userId substitution). **6 new Playwright E2E specs** for the new pages themselves. Full regression: 617/617 unit tests, 126/126 E2E specs (one pre-existing, already-disclosed CRM-settings flake confirmed unrelated on isolated rerun), `npx tsc --noEmit` clean, ESLint clean (zero warnings on every touched file), and a full production build succeeding with every new route present in the build output.

**Remaining, disclosed risks for a future RC pass:** staff account deactivation (`UserRepository` has no status-mutating method at all yet — a pre-existing gap this module's own test suite ran into and disclosed rather than silently working around); no dedicated brute-force/lockout coverage at the E2E/HTTP layer (covered instead by real, in-process `authService.login()` unit tests exercising the exact same code path); OAuth's real vendor handshake (Google/Microsoft token exchange, GitHub email-privacy fallback) is unit-tested against a mocked `fetch`, not a live vendor sandbox — the same category of disclosed limitation Module 8.5's own WhatsApp Embedded Signup pass took for its own external-boundary dependency.

**RC-1 (Authentication & Identity) is complete against its own approved scope.** Per this pass's own explicit instruction, RC-2 was not started — this is where the mission itself said to stop.

---

## WhatsApp Embedded Signup — Module 8.5 (Post-V1, Phase 8 complete)

**Goal:** the mission's own words — a production-ready tenant onboarding flow so an organization can connect its own WhatsApp Business Platform account using Meta's official Embedded Signup architecture, so a SaaS customer never needs LearnSynaptic staff to edit environment variables, database records, or source code to get WhatsApp working. This is the fifth and final planned Phase 8 module — **Phase 8 (Multi-Tenant SaaS Foundation) is now FULLY COMPLETE.**

**Module 8.4 re-verified first, per this pass's own explicit instruction.** Confirmed directly against the codebase: `tsc --noEmit` clean, 481 unit tests green, tenant branding isolation/entitlement gating/default-fallback behavior unchanged since shipping. No production-critical 8.4 gap found. Proceeded straight to 8.5.

**Audited the existing WhatsApp architecture exhaustively before writing any code**, per the mission's own explicit instruction: the real Meta Cloud API adapter (`metaCloudApi.provider.ts`), the deployment-wide provider registry (`getWhatsAppProvider()`, a pure function of one env var — the one real architectural gap this module needed to close, below), the Module 2.3 phone-health/template-sync architecture, the Module 2.4 webhook-monitoring/delivery-logging architecture, the Module 8.2 tenant-credential resolver and encrypted `tenant_secret` storage, and the Module 8.3 entitlement layer. Reused every one of them; built nothing that already existed.

**Two real architectural gaps were found during the audit, not assumed — both were prerequisites for tenant self-service to mean anything, and both are now fixed:**

- **Provider selection was deployment-wide, not tenant-aware.** `getWhatsAppProvider()` picked ONE vendor class for the entire deployment from `WHATSAPP_PROVIDER` — an organization with genuinely valid, self-connected Meta credentials would still have every send routed through whichever provider the deployment's own env var picked (typically `console`, this app's zero-config default), meaning a fully-connected tenant's messages would silently never reach Meta at all. Fixed with `resolveWhatsAppProviderForSend()` (`registry.ts`): resolves to `meta-cloud-api` specifically for any organization with a real, resolvable tenant `accessToken`+`phoneNumberId` (reusing Module 8.2's own credential resolver), falling back to the deployment-wide provider otherwise — the same "tenant credential first, env config always the fallback" precedent Module 8.2 established for credential *values*, now applied to provider *class* selection. Wired into `queue.ts`'s send path and every other `whatsappService` method that calls a provider directly.
- **Inbound webhooks had no tenant routing at all.** A real Meta Embedded Signup deployment has ONE Meta App shared across every tenant's own WABA via System User permissions — meaning every organization's inbound webhook traffic arrives at this app's single existing `/api/webhooks/whatsapp` endpoint, with no way to tell them apart. Fixed by extending the existing, unique-globally `PhoneNumberRecord` (Module 2.3's own health table) into the routing table: `extractPhoneNumberId()` reads Meta's real `metadata.phone_number_id` field from the payload (after signature verification, which stays platform-level and unchanged — one shared App Secret correctly verifies every tenant's own webhook deliveries), and `phoneNumberService.findByPhoneNumberId()` resolves the owning organization via a deliberately tenant-scope-bypassing lookup (the same `skipTenantScope` escape hatch `authService`'s own cross-org user lookup already established) — safe by construction, since a real phone number belongs to exactly one WABA. Everything downstream (`applyStatusEvent`, `conversationService.recordInboundMessage`, delivery logging) now runs inside that organization's own `runWithTenantContext`. An unrecognized number falls through to the existing default-organization behavior, unchanged — Module 8.1's own disclosed posture, not a regression.

**A real, disclosed bug in the pre-existing Integrations Registry was found and fixed along the way, not shipped.** `toSummary()`'s builtIn-provider branch always derived `status`/`enabled`/`health` from this deployment's own env-driven default (`getBuiltInStatus()`), never from an organization's own tenant connection — meaning a fully, correctly self-connected WhatsApp organization would still see its own Settings card claim "disconnected." Fixed with a deliberately narrow `preferTenantStatus` check scoped to `providerId === "whatsapp"` specifically (not inferred from `connection.status` alone, since the repository's own `create()` unconditionally sets that to `"connected"` for every provider on first insert) — email/OpenAI/Anthropic/Gemini's own existing Module 8.2 behavior is completely unchanged, zero regression for providers this module never touches. `integrationService.setTenantCredentials()` gained an optional `options` parameter (`config`, `markConnected`) — both additive, every pre-8.5 caller (the generic credentials route, `TenantCredentialsForm`) omits them and behaves byte-for-byte as before.

**Architecture — one new orchestration service, reusing every existing mechanism rather than inventing parallel ones:**

- **`lib/services/whatsapp/embeddedSignup/`** — `metaGraphClient.ts` (the real, documented Meta Graph API calls Embedded Signup needs beyond messaging: authorization-code exchange, WABA phone-number discovery, webhook subscribe/unsubscribe) and `embeddedSignupService.ts` (the tenant-facing orchestration: `connect()`, `disconnect()`, `getConnectionSummary()`). `connect()` is gated by Module 8.3's own `entitlementService.assertCapability(orgId, "whatsapp_embedded_signup")` — a new `PlanCapability` registered alongside the existing `"whatsapp"`/`"whatsapp_campaigns"` — never a hardcoded plan-name check, and never trusts the client-reported WABA/phone number alone: every candidate phone number is re-derived from Meta itself using the just-exchanged access token, which can only ever see assets that specific authorization actually granted.
- **Real cross-tenant conflict guard, proven by test, not assumed:** connecting a phone number already routed to a different organization is rejected outright (`phone_already_connected`), never silently reassigned. Idempotent by construction: reconnecting with the same phone number updates the same `IntegrationConnection`/`PhoneNumberRecord` rows in place (never a duplicate); switching to a different number automatically releases the organization's own prior routing entry via a new, explicit `clearOrganization()` repository method (deliberately NOT `upsertHealth({organizationId: undefined})` — Mongoose silently strips `undefined`-valued keys from an update document by default, which would have appeared to work against the in-memory test store while silently no-opping against real MongoDB; caught before it shipped, not after).
- **Safe disconnect, never destructive:** clears the encrypted credential (Module 8.2's own `clearTenantCredentials()`), best-effort revokes this app's webhook subscription on the tenant's WABA (a revoked/expired token failing this call is expected and never blocks the local disconnect), and releases the phone number's routing entry — Conversations/Messages/Activities/audit history are never touched.
- **The rich, mission-named connection states** (Not Connected / Connecting / Connected / Healthy / Action Required / Token Expired / Webhook Error / Phone Verification Required / Disconnected) are a derived value computed fresh from real, current facts (`IntegrationConnection.status`/`.health`/`.lastError` + `PhoneNumberRecord.verificationStatus`) every time they're asked for — never a separately stored, independently-driftable status field.
- **Health check and template sync are now genuinely per-tenant.** Both existing Module 2.3 scheduler jobs still run once for this deployment's own default/env-configured number (unchanged), then loop once per organization with a real connected WABA (`forEachConnectedOrganization()`, a cross-tenant sweep resolving the list, then entering each organization's own tenant context — the identical pattern Module 8.3's own billing period-check job already established) — reusing `CampaignTemplateRepository`/`PhoneNumberRepository` exactly as they already exist, never a second monitoring system.

**API routes** (`app/api/admin/integrations/whatsapp/embedded-signup/{config,complete,status,disconnect}`), all `requiredRole:"admin"` (the same tier every other Integrations Registry lifecycle route already enforces — Counsellor has no provider-connection capability, Manager doesn't either): `config` returns only the platform App ID/Config ID an authenticated admin's browser needs to render the Facebook JS SDK button (never the App Secret), plus a real, server-checked `entitled` flag; `complete` additionally gates on `requiredCapability:"whatsapp_embedded_signup"` at the route level, on top of (not instead of) the service's own internal check — the same belt-and-suspenders pattern Module 8.3 established for `whatsapp-campaigns`. `organizationId` is never accepted from the request body on any route — always resolved from the caller's own authenticated tenant context, so there is no code path through which Organization A could even construct a request touching Organization B's connection.

**Admin UI — extended, not redesigned.** A new `WhatsAppEmbeddedSignupPanel` renders inside the EXISTING WhatsApp `IntegrationCard` (the same card every other provider already renders inside, using the same Badge/Button components) — a real "Connect WhatsApp" button loading the actual Facebook JS SDK (already whitelisted in this app's own CSP, `connect.facebook.net`/`graph.facebook.com` — someone anticipated this build), reconciling the popup's own two independent signals (the `FB.login` callback's authorization code, and a separate `window.message` event reporting the selected WABA/phone number) before POSTing to the completion route. The existing manual `TenantCredentialsForm` (Module 8.2's own raw key-value credential paste) is preserved, demoted to a collapsed "Advanced: manual credential configuration" fallback — not removed, since it remains a legitimate escape hatch for a tenant whose setup doesn't go through Embedded Signup.

**Security & multi-tenant testing — proven, not asserted:**

- **35 new unit tests**: `metaGraphClient.ts`'s own real request/response shapes against mocked Meta responses (success, rejection, network failure); `embeddedSignupService`'s full orchestration (entitlement gating, the real "platform not configured" degradation, real ownership re-verification rejecting a client-claimed phone number Meta's own WABA phone list doesn't contain, zero-phone-numbers rejection, idempotent reconnect with a real duplicate-row assertion, the cross-tenant conflict guard, safe disconnect); `resolveWhatsAppProviderForSend`'s own tenant-vs-deployment-default resolution; `extractPhoneNumberId`'s real Meta payload-shape parsing; a dedicated two-organization webhook-routing test proving each organization's own phone number resolves only to itself.
- **8 new Playwright E2E specs** (`tests/e2e/tenantWhatsAppEmbeddedSignup.spec.ts`, real HTTP against the real running server): RBAC floor (counsellor/manager forbidden on every new route); the real, honest "platform not configured" response (never a fabricated success) for an org whose plan genuinely includes the capability; a real 403 for an org whose plan doesn't; two real organizations with two real distinct WhatsApp connections (via Module 8.2's own tenant-credential mechanism — the same underlying storage a completed Embedded Signup writes to) never leaking into each other's response bodies, credential values masked even for the owning organization; disconnecting one organization proven to never affect another's; disconnecting a never-connected organization succeeding gracefully rather than a 500.
- **Live-verified against a real MongoDB replica set via two real, independently-created organizations and real logged-in browser sessions**: Org A and Org B each configured with genuinely distinct WhatsApp credentials/phone numbers, confirmed in the real Settings UI that each organization's own WhatsApp card correctly shows "connected"/"enabled" (proving the `preferTenantStatus` fix works for real, live, against this deployment's own actual `WHATSAPP_PROVIDER=console` default) and the honest "Embedded Signup isn't configured on this deployment yet" disclosure (since no live Meta App exists in this environment); confirmed via a real authenticated fetch that Org B's own connection status reports its own distinct `phoneNumberId`, never Org A's; zero console errors.
- **Real, live Meta Embedded Signup verification status: REQUIRES LIVE META CREDENTIALS.** No `WHATSAPP_META_APP_ID`/`CONFIG_ID`/`APP_SECRET` exist in this environment — the actual Facebook Login popup handshake and a genuine Meta code exchange are unverified here, disclosed explicitly rather than faked. Everything up to that external boundary (code-exchange request shape, WABA/phone re-verification logic, credential storage, webhook routing, disconnect/reconnect, RBAC, entitlement, tenant isolation, the honest "not configured" degradation) is real and proven by the tests above — see `WHATSAPP_EMBEDDED_SIGNUP.md` for the full Meta App Dashboard setup this deployment's operator needs to complete before a real customer can connect.

**Regression:** 523 unit tests (481 prior + 42 new — 35 for this module plus fixes/coverage incidental to the `toSummary()` bug fix), full Playwright suite 118–120/120 (112 prior + 8 new), zero new flakes; the same two pre-existing, already-disclosed flakes (CRM Settings assignment-rule race, the unrelated pre-existing Contact-form regression) confirmed unrelated on isolated rerun. `npx tsc --noEmit`, ESLint (scoped to every file this module touched, including one real `react-hooks/set-state-in-effect` violation found and fixed in the new signup panel before it shipped), and a full production build (all 4 new API routes present in the build output) all clean.

**Module 8.5 is complete against its own approved scope.** Tenant WhatsApp self-service is real, entitlement-gated, tenant-isolated at every layer (credentials, routing, connection state), and reuses the platform's own existing WhatsApp send/receive/campaign/automation architecture with zero duplicated "SaaS WhatsApp" code path. Per this pass's own explicit instruction, no V2 work, Student Portal, LMS, or AI Mentor work was started. **This was the fifth and final planned Phase 8 module — Phase 8 (Multi-Tenant SaaS Foundation) is now FULLY COMPLETE:** 8.1 Tenant Data Isolation, 8.2 Tenant Context & Credentials, 8.3 Billing/Plans/Feature Flags, 8.4 White Label & Branding, and 8.5 WhatsApp Embedded Signup all shipped and live-verified.

---

## White Label & Branding — Module 8.4 (Post-V1, Phase 8 continues)

**Goal:** the mission's own words — `Organization -> Subscription/Entitlement -> Brand Configuration -> Theme Resolver -> Existing Design System -> Tenant-Branded Experience`. Eligible organizations customize their Business OS appearance without modifying the app or standing up a separate deployment; LearnSynaptic's own branding remains the default/fallback for every unconfigured or unentitled organization; the existing admin UI is extended, never redesigned.

**Module 8.3 re-verified first, per this pass's own explicit instruction.** Confirmed directly against the codebase: `tsc --noEmit` clean, 457 unit tests green, entitlement/usage-limit/concurrency logic unchanged since shipping, the default LearnSynaptic organization's own subscription still self-heals correctly. No production-critical 8.3 gap found. Proceeded straight to 8.4.

**Audited the existing design system before writing any code**, per the mission's own explicit instruction: `app/globals.css`'s hand-rolled `--adm-*` CSS custom-property theme (toggled via a `data-theme` attribute, no Tailwind theme-config integration), the admin shell's `AdminAuthProvider`/`AdminThemeProvider` client-context-plus-fetch-on-mount pattern (the only way this `"use client"` dashboard layout gets per-session data, since there is no server-rendered per-request admin page), Module 6.2's File Storage (`fileStorageService`, magic-byte content validation for png/jpeg/gif/webp/pdf, no such check for SVG), the `Organization` model (confirmed minimal, no branding field of any kind), `middleware.ts` (Edge runtime, no DB access, no custom-domain-to-org mapping — the reason branded login is deferred, below), and `emailService.sendEmail` (confirmed `bodyHtml` is plumbed end-to-end but genuinely never used by any real caller — plain text only, in production, today). Reused everywhere it applied; built nothing that already existed.

**Architecture — one new tenant-scoped collection, one theme resolver, four narrow CSS-variable overrides, nothing else touches the design system:**

- **`BrandConfiguration`** (`lib/db/models/brandConfiguration.model.ts`, tenant-scoped via the existing `tenantScopePlugin`, unique on `organizationId`) — `displayName`/`logoFileId`/`compactLogoFileId`/`faviconFileId`/`accentColor`/`primaryColor`/`supportEmail`/`supportUrl`/`websiteUrl`/`footerText`. Every asset field is a `FileAsset` id, not a URL — Module 6.2's own storage/ownership/access-control stays authoritative, this module never invents a second upload path.
- **`themeResolver.ts`'s `resolveBranding(organizationId)`** — the ONE place a `BrandConfiguration` row becomes the render-ready shape every consumer (admin shell, outbound email footer) actually uses. Two real gates collapse to the safe, unmodified default: (1) `entitlementService.hasCapability(orgId, "white_label")` — never a hardcoded plan-name check, reusing Module 8.3's own entitlement layer exactly as that module named it as a Module 8.4 dependency — and (2) whether a configuration actually exists at all. Either "no" returns `DEFAULT_BRANDING` (the current, unmodified LearnSynaptic identity), never a broken or half-applied theme.
- **CSS overrides are deliberately narrow — never the entire design system.** Only four custom properties are ever overridden at render time (`--adm-accent`/`--adm-accent-hover`/`--adm-accent-soft`/`--adm-accent-2`, derived server-side from the tenant's own accent/primary colors) — text, surface, border, and background tokens stay exactly as `globals.css` defines them regardless of what a tenant picks. This is what makes "tenant branding must NOT destroy usability" true by construction, not by convention: a tenant can only ever pick a button/accent color, never a text-on-background combination that could become unreadable. Applied via a small inline `style` object on the admin shell's root element (`app/admin/(dashboard)/layout.tsx`), which reliably wins over the stylesheet's own rule for the same custom property — never a second, separate CSS bundle generated per tenant.
- **Real WCAG 2.1 contrast validation, not an approximation** (`lib/services/branding/contrast.ts`): actual relative-luminance sRGB linearization and the real `(L1+0.05)/(L2+0.05)` ratio formula, gating every submitted accent color against two real thresholds before it is ever saved — 4.5:1 against white (button text) and 3:1 against the admin shell's own dark background (UI indicators/focus states). An unreadable choice is rejected server-side with a specific, real reason (e.g. "this color is too light — white button text on it would only have a 1.1:1 contrast ratio"), never silently clamped or silently applied.

**Entitlement-gated, server-enforced — never a UI-only restriction.** `brandingService.updateConfiguration()` calls `entitlementService.assertCapability(orgId, "white_label")` before touching the database — an organization on a plan without `white_label` gets a real 403 on save, proven end-to-end over real HTTP (not just asserted): a dedicated Playwright spec assigns such an org a real plan lacking the capability and confirms the save is rejected server-side "regardless of what the form shows," the same phrase the mission itself used.

**Asset ownership verified on every save, never trusted from the client.** `updateConfiguration()` resolves each submitted `logoFileId`/`compactLogoFileId`/`faviconFileId` through `fileStorageService.getFile()` and rejects (400, `asset_not_found`) unless the file is real, not soft-deleted, AND owned by the calling organization — a logo id belonging to a different tenant is never accepted, proven directly (unit test) and over real HTTP (Playwright: Org A uploads a real SVG logo, Org B's attempt to reference that same file id in its own branding config is rejected).

**Input validation — rejects unsafe values outright, never stores them for later rendering:**
- `displayName`/`footerText` reject any `<`/`>` character (no markup of any kind ever reaches storage, let alone rendering).
- `supportUrl`/`websiteUrl` require `http(s)://` — a `javascript:` URL is rejected with a real 400, never stored.
- `supportEmail` is validated against a real email-shape regex.
- Colors are delegated to the same WCAG-based `validateBrandColor()` described above.
All four rejection paths (markup, unsafe URL scheme, unsafe color, cross-tenant asset) are proven with real HTTP requests in `tests/e2e/tenantBranding.spec.ts`, not just unit-level.

**Cache — tenant identity is structurally the cache key, not merely a convention.** `resolveBranding()`'s 60-second-TTL cache is a `Map<organizationId, CacheEntry>` — there is no code path that could read one organization's cache entry for another's request, because the key IS the tenant id. `brandingService.updateConfiguration()`/`resetConfiguration()` additionally call `invalidateBrandingCache()` explicitly on every write (belt and suspenders on top of the short TTL, not a substitute for it). Both properties — cross-tenant isolation and real invalidation, not an always-fresh no-op cache — are proven directly by a dedicated test: changing Org A's branding twice while repeatedly re-reading Org B's cached entry confirms it never moves, and a direct repository write that deliberately bypasses `brandingService`'s own invalidation call is confirmed still-stale until `invalidateBrandingCache()` is called, then confirmed fresh immediately after.

**Admin shell integration — extended, not redesigned:**
- **`AdminBrandingProvider`** (`components/admin/AdminBrandingContext.tsx`) — the same fetch-on-mount React Context pattern `AdminAuthProvider`/`AdminThemeProvider` already established, wired into the existing admin layout. Swaps `document.title` and the favicon `<link>` only when `branding.isCustom` is true — an unconfigured org's tab keeps reading "LearnSynaptic" exactly as before.
- **`Sidebar.tsx`** — conditionally renders the tenant's own compact logo (a plain `<img>`, since it's a runtime-resolved signed URL, not a build-time asset) in place of the default gradient mark, and the tenant's own `displayName` in place of the hardcoded "LearnSynaptic" string. Verified at 320px/375px viewport widths with a genuinely long organization name ("Northwind Very Long Organization Name Traders Ltd") — truncates cleanly with no overflow, clipping, or layout shift in either the collapsed desktop sidebar or the mobile header/drawer.
- **A new "Branding" section on the existing Settings page** (admin-only, matching Integrations' own floor), built entirely from this app's existing Card/Form/Upload/Button/Toast components: organization display name, logo/compact-logo/favicon upload (reusing the existing file-upload flow), accent/secondary color pickers with live contrast feedback, support email/URL/website/footer-text fields, Save/Reset-to-default. The SAME `resolveBranding()` the admin shell itself renders from is what the panel reads back after a save — never a separate, potentially-divergent preview path.

**Branded login — deliberately NOT attempted, a disclosed architectural gap, not a corner cut.** Per the mission's own explicit "do NOT weaken authentication or tenant resolution to achieve branded login pages": `middleware.ts` runs on the Edge runtime with no database access and no custom-domain-to-organization mapping field anywhere in the schema, so there is currently no way to know WHICH organization is about to log in before authentication has happened — the prerequisite branded login would need. A documented disclosure comment was added to `app/admin/login/page.tsx` explaining this precisely; no functional change was made, and no unsafe pre-auth tenant-resolution shortcut was invented to force the feature to "work." Real branded login needs a genuine custom-domain/subdomain architecture — a bounded future module, not this one.

**Custom domains — out of scope for this pass, not pretended-complete.** No domain-mapping, ownership-verification, or DNS/SSL provisioning of any kind was implemented; `BrandConfiguration` carries no domain field. Reviewed against the blueprint and found not to be part of Module 8.4's own approved scope — documented here as a future extension rather than left unaddressed.

**Email branding — a safe plain-text footer, no HTML templating built from scratch.** Since the pre-build audit confirmed `bodyHtml` is never actually used by any real caller today, there is no HTML surface to sanitize or inject into. `emailService.sendEmail()` reads the ambient tenant context, resolves branding, and appends a plain `\n\n---\n{footerText}\n{Support: supportEmail}` block to `bodyText` — only when the organization is entitled, configured, AND has at least one of `footerText`/`supportEmail` set. Proven at the real call site (not just `resolveBranding()` in isolation): a spy on the console email provider's own actual send confirms the footer text reaches the real outbound payload for an entitled+configured org, and confirms the email is byte-for-byte unchanged for an unentitled org and for a request with no tenant context at all (e.g. a system-triggered send). WhatsApp/PDF-export/notification branding was reviewed and intentionally left untouched this pass — WhatsApp business identity (display name, profile photo) is Meta-controlled and explicitly out of this module's reach per the mission's own instruction; no PDF-export branding surface currently exists in the codebase to extend.

**A real bug was found and fixed by this module's own test suite, not shipped.** `themeResolver.ts`'s `hasAnyCustomization` flag originally only checked `displayName`/logo/favicon/cssVariables — a configuration with ONLY `footerText` set (no logo, no color, no display name) resolved `isCustom: false` even though `footerText` itself came through correctly in the resolved shape, silently breaking the email-footer feature for that exact case. Caught by a dedicated email-branding test asserting the footer text reaches the actual outbound payload; fixed by including `supportEmail`/`supportUrl`/`websiteUrl`/`footerText` in the customization check.

**Security & multi-tenant testing — proven over real HTTP with two genuinely different organizations, not asserted:**
- **24 new unit tests** (`lib/services/branding/*.unit.test.ts`, `lib/services/email/emailBranding.unit.test.ts`): entitlement gating (save rejected without `white_label`, accepted with it); asset-ownership verification (a foreign fileId rejected, an owned one accepted); default-fallback and reset behavior; a downgrade (losing `white_label` mid-subscription) collapsing a previously-saved configuration back to the safe default without deleting the underlying row; cache cross-tenant isolation and real invalidation; the email-footer integration at the real `sendEmail()` call site.
- **9 new Playwright E2E specs** (`tests/e2e/tenantBranding.spec.ts`, real HTTP against the real running server): RBAC floor (counsellor can read resolved branding but not the raw config, manager cannot manage branding at all — same admin-only tier Integrations already requires); entitlement enforcement server-side; two real organizations with two real, distinct configurations, full response bodies never mentioning the other org's identity in any form; cross-tenant asset rejection; unsafe-color/unsafe-URL/markup rejection with real, specific error reasons; reset making a subsequent read indistinguishable from never-configured.
- **Live-verified against a real MongoDB replica set via two real, independently-created organizations and real logged-in browser sessions** (not the seeded test fixtures — two fresh organizations, two fresh admin accounts, one real white-label-capable Plan assigned to both, two genuinely different brand configurations saved through the real Settings → Branding UI): Org A ("Acme Rocket Co", green accent `#15803d`) and Org B ("Northwind Very Long Organization Name Traders Ltd", orange accent `#c2410c`) each rendered their own distinct sidebar logo slot, display name, and accent color across nav highlights, avatar, and buttons — confirmed by direct screenshot comparison across two separate real sessions, not API assertions alone. The unsafe-color rejection was triggered live in the real Settings form and showed the real, specific contrast-ratio message. The Branding panel's own read-back for each org showed only that org's own saved values — Org B's raw config API response never mentioned Org A's identity. Responsive-checked at 320px, 375px, and ~1470–1547px: the long Org B name truncates cleanly in the collapsed desktop sidebar and renders in full (no clipping) in the mobile header, with no console errors at any width.

**Regression:** 481 unit tests (457 prior + 24 new, all green), full Playwright suite 112/112 green (105–112 depending on the specific pre-existing flake's reproduction that run — this run, notably, showed zero flakes at all). `npx tsc --noEmit`, ESLint (scoped to every file this module touched), and a full production build (both new branding API routes present in the build output) all clean.

**Known limitations, disclosed rather than hidden:** branded login/auth surfaces are architecturally deferred (documented above, not implemented); custom domains are out of scope for this pass (documented above); WhatsApp/PDF-export branding is untouched (no PDF-export surface exists yet; WhatsApp identity is Meta-controlled); the 60-second theme-resolver cache means a branding change can take up to a minute to reflect for a request that somehow bypasses the explicit `invalidateBrandingCache()` call (no such path exists today, but it is the honest bound of the TTL-plus-explicit-invalidation design, not a guarantee of zero staleness under an unknown future code path).

**Module 8.4 is complete against its own approved scope.** Tenant branding is real, server-enforced (never UI-only), safe by construction (contrast-validated before storage, narrow CSS-variable surface, cross-tenant isolation proven at the cache/asset/config layers), and the default LearnSynaptic experience is byte-for-byte unchanged for every unconfigured or unentitled organization. Per this pass's own explicit instruction, Module 8.5 remains untouched — no V2 work, no admin-panel redesign, no unrelated website/page-builder functionality.

---

## Billing, Plans & Feature Flags — Module 8.3 (Post-V1, Phase 8 continues)

**Goal:** the mission's own words — the commercial entitlement layer: `Organization -> Subscription -> Plan -> Entitlements -> Usage Limits -> Feature Access`. LearnSynaptic must keep using the platform internally while the same architecture supports real SaaS plans, per-plan feature access, usage limits, metering, safe upgrade/downgrade/cancellation, trials, and a real connection to Module 6.4's existing Payment platform — without hardcoding business logic to plan names anywhere.

**Module 8.2 re-verified first, per this pass's own explicit instruction.** Confirmed directly against the codebase: `tsc --noEmit` clean, all 423 unit tests green, `credentialResolver.ts`/tenant context unchanged, no production-critical gap found. Proceeded straight to 8.3.

**Audited existing billing-adjacent infrastructure before writing any code**, per the mission's own explicit instruction: Module 6.4 Payments (`Payment`/`PaymentProvider`/`PaymentWebhookEvent` — confirmed **no subscription/recurring-billing concept exists anywhere**, every payment is a one-off checkout, no interval/cycle/nextBillingAt field on `Payment` at all); `Organization` (confirmed deliberately minimal — no plan/tier/billing field of any kind); the 3-tier RBAC (`counsellor|manager|admin`, confirmed **no platform-level Super Admin role exists**); the rate limiter (confirmed per-route/per-IP throttling, not a per-organization business-quantity counter); zero pre-existing feature-flag system anywhere in the repo (only the established env-driven "one active provider" selector convention, a different concept). Reused everywhere it applied; built nothing that already existed.

**Architecture — a new `lib/services/billing/` module, four new collections, entitlements resolved live, never hardcoded to a plan name:**

- **`Plan`** — the global, platform-level SaaS catalog (`lib/db/models/plan.model.ts`, deliberately NOT tenant-scoped — a Plan is configuration every organization reads, not organization-owned data, the same distinction `providerCatalog.ts` already draws for its own static registry). `id`/name/description/status/billingInterval/currency/basePrice/`capabilities: PlanCapability[]`/`limits: Partial<Record<UsageMetric,number|null>>`/trialDays/metadata/`version` (bumped on every edit — provenance, not a resolution key; entitlements always resolve against the CURRENT plan document, never a frozen snapshot). 14 real, closed-union capability ids (`crm`/`whatsapp`/`whatsapp_campaigns`/`automation`/`ai_crm`/`email`/`analytics`/`integrations`/`file_storage`/`calendar`/`payments`/`webhooks`/`team_members`/`white_label` — the last one named now, enforced nowhere yet, for Module 8.4) and 9 usage metrics (`seats`/`leads`/`whatsapp_messages`/`whatsapp_campaign_sends`/`automation_executions`/`ai_requests`/`storage_bytes`/`integrations`/`webhook_deliveries` — deliberately no separate "contacts" metric alongside `leads`, since this app's own data model has no distinct Contact entity, a fabricated distinction would have been dishonest).
- **`Subscription`** — one row per organization (tenant-scoped via the existing `tenantScopePlugin`, unique on `organizationId`), state machine `trialing -> active -> past_due -> cancelled|suspended|expired`. `ACTIVE_SUBSCRIPTION_STATUSES` (`trialing`/`active`/`past_due`) is the one place "does this org currently have access" is decided — `past_due` deliberately still counts as active, a real grace period, not an immediate cutoff.
- **`entitlementService`** — the ONE place a capability/limit check happens. `hasCapability()`/`assertCapability()` (throws a new `EntitlementError`, never returns a silently-ignorable boolean for enforcement call sites) resolve against `ACTIVE_SUBSCRIPTION_STATUSES` + the current plan's own `capabilities` set — application code never compares `plan.id`/`plan.name` anywhere in this codebase. **Self-healing, not a one-time migration script**: `subscriptionService.getForOrganization()` transparently, idempotently (race-safe via the same find-or-create-then-re-read pattern `ensureDefaultOrganization()` already established) provisions ANY organization with no explicit Subscription yet — including LearnSynaptic's own real default org — onto a real, fully-capable, zero-price `internal-unlimited` Plan (`billingInterval:"internal"`, all 14 capabilities, no limits) the first time anything asks for its entitlements. This is what makes "Do NOT break the internal Business OS" true by construction rather than by a backfill script that could miss a future org.
- **`usageService`** — real, persisted, atomically-incrementable counters (`UsageCounter`, one row per organizationId+metric+period, tenant-scoped), never derived by counting another collection on every request. `checkAndIncrementUsage()` uses an increment-then-compensate algorithm (increment first, unconditionally; if the result is over the limit, issue a second atomic `-delta` rollback) — the only correct way to make a limit check race-safe without a database transaction, since MongoDB's own `$inc` is atomic per-document regardless of how many callers race it. **A real concurrency bug was found and fixed by this module's own test suite, not shipped**: the in-memory `UsageCounterRepository.incrementAndGet()` returns the SAME mutable object it stores internally (the established convention every in-memory repository in this codebase already follows) — the original implementation read `afterIncrement.count` a second time AFTER issuing the rollback's own `incrementAndGet()` call, silently seeing the rollback's mutation applied retroactively to that reference and returning a corrupted `current` value. Fixed by capturing the count into a primitive immediately after the forward increment, before the rollback call exists at all. Caught by a dedicated 20/30-way `Promise.all` concurrency test racing a hard limit — a real race, not a hypothetical: Node's single-threaded event loop still genuinely interleaves separate promises at `await` boundaries, so a broken read-then-write algorithm would (and, before the fix, did) show incorrect results under this exact test shape. `seats` and `storage_bytes` are STOCK metrics (a current level that goes up AND down, e.g. deleting a file frees storage) as opposed to FLOW metrics (a per-period count that only accumulates and resets monthly) — `storage_bytes` uses a `LIFETIME_USAGE_PERIOD` sentinel instead of the current calendar month; `seats` is deliberately a LIVE headcount read directly from the User collection at enforcement time (`authService.createUser()`), never routed through the period-scoped counter at all, since a stock quantity that can decrease must never be modeled as a monotonic counter.
- **`featureFlagService`** — platform feature flags, DELIBERATELY separate from plan entitlements (a capability answers "does this org's PLAN include this commercially"; a flag answers "is this switched on for this deployment/org at all, independent of billing" — e.g. a gradual AI-feature rollout). `FeatureFlag` (global, not tenant-scoped) with optional per-organization overrides, checked before the platform-wide default.

**Enforcement — real, server-side, at the actual call sites, not just a service that exists in isolation:**

- **`withApiRoute.ts` gained `requiredCapability`**, parallel to the existing `requiredRole` — the mission's own explicit "avoid feature-check logic scattered throughout the application," resolved centrally through `entitlementService`. Checked after tenant context is established and after `requiredRole` (cheaper, more fundamental check first). Denial throws a new `PlanEntitlementRequiredApiError` (403).
- **Seats** (`authService.createUser()`): a real, server-enforced seat limit compares the plan's limit against a LIVE count of the organization's active users — rejects creating a user beyond the limit, the rejection never persists a row. `CreateUserInput` gained `organizationId`, resolved the same "tenant context, or the deployment's default org" way every other public-route service already resolves it.
- **WhatsApp send** (`lib/services/whatsapp/queue.ts#processSendJob` — the one real chokepoint every template/text send funnels through: registration confirmations, cohort reminders, automation-triggered sends, conversation replies): checks the `whatsapp` capability and atomically meters `whatsapp_messages` BEFORE calling the real vendor provider — a denied send never reaches Meta/AiSensy/etc., proven with a mocked-fetch test asserting the vendor call count never increments on denial.
- **Automation execution** (`lib/services/automation/engine.ts#advanceWorkflowRun`): "one billable execution" is defined as exactly one real `step.execute()` about to run — never a step skipped by its own condition, never double-counted per retry attempt within the same cycle. Checked/incremented BEFORE `execute()`, so a denied step never partially runs its own side effects (a WhatsApp send, a task creation).
- **AI requests** (`lib/services/ai/registry.ts#getAiProvider`): wraps the returned provider in a metering decorator at this ONE seam, covering all three real callers (lead scoring/insights, AI-assisted replies, conversational analytics) automatically — checks `ai_crm` + meters `ai_requests` before the real vendor call. Meters by REQUEST COUNT only, never invented per-token/cost numbers — none of the three vendor adapters currently parse the vendor's own token-usage fields, and the mission's own explicit "do NOT invent token/cost numbers when providers do not return them" rules out fabricating one; a real, disclosed follow-up.
- **Storage upload** (`fileStorageService.uploadFile()`): checks `file_storage` + atomically meters `storage_bytes` (real file size, not a flat "1 per upload," since this is a stock metric) before any real upload attempt. **Deliberately THROWS `EntitlementError` here** (unlike this function's other validation failures, which return a `{success:false,errors}` result) — the one caller (`app/api/admin/files/route.ts`) needs to distinguish a real 402 (usage limit) from a real 403 (missing capability) from an ordinary 400, proven end-to-end: a real HTTP request against a 10-byte storage limit returns a genuine `402` with `X-Usage-Current`/`X-Usage-Limit` response headers, and the rejected upload never partially creates a `FileAsset` row.
- Two real ROUTES additionally gate at the `withApiRoute` level (`whatsapp-campaigns` POST → `requiredCapability:"whatsapp_campaigns"`, `files` POST → `requiredCapability:"file_storage"`) — on top of, not instead of, the deeper service-layer checks above.

**Payment integration — reuses Module 6.4 exactly, never a second payment system.** `billingPaymentIntegration.createRenewalCheckout()` calls `paymentService.createPayment()` — the SAME function the existing admin "Create Payment" UI already calls — with `purpose:"subscription_renewal"`. A new event subscriber (`registerBillingPaymentSubscriber()`, wired into `lib/events/eventBus.ts`'s own self-bootstrapping list, the same pattern automation triggers and the Module 6.5 webhook fan-out already use) reacts to the SAME `"payment.success"`/`"payment.failed"` domain events every other payment-outcome consumer already subscribes to, filtered to this module's own `subscription_renewal` purpose: a successful renewal extends `currentPeriodEnd` and reactivates; a failed one marks `past_due`. **Disclosed scope, not a corner cut**: none of Module 6.4's three real gateways (Razorpay/Stripe/Cashfree) implement true recurring/auto-charge billing in this app — every one is a one-off hosted-checkout flow, confirmed during the pre-build audit. This module's own real, working piece is the STATE MACHINE connection (proven directly by unit test); genuine automatic recurring charging would need a materially larger Module 6.4 gateway integration (Razorpay Subscriptions / Stripe Billing APIs), a real, bounded follow-up.

**Scheduler integration** (`billing.period_check`, hourly, wired into `scheduler/bootstrap.ts`'s own self-bootstrapping list, the same 4-part pattern every other job type already uses): a global, no-organizationId job — its own handler does an explicit `runCrossTenantSweep()` before entering each individual subscription's own tenant context to apply a transition. Expires a `trialing` subscription whose `trialEndsAt` has passed; expires a `past_due` subscription after a real, concrete 7-day grace period (`PAST_DUE_GRACE_DAYS`, the mission's own "grace period extension point," made a real number rather than left unimplemented); applies a reached `cancelAt` (cancel-at-period-end). **No tenant data is ever deleted by cancellation, downgrade, or expiration at any point in this module** — every one of these state transitions changes only future entitlement resolution.

**Platform vs. tenant admin — a real, minimal gate, not an invented role tier.** This app has no platform-level Super Admin role (confirmed during the pre-build audit, unchanged since Module 8.1/8.2's own audits). Rather than inventing one speculatively, Plan-catalog and feature-flag WRITE routes reuse the exact bearer-secret pattern `config/cron.ts`/`verifyCronSecret.ts` already established (`config/platformAdmin.ts`, `PLATFORM_ADMIN_SECRET`, constant-time comparison, fails closed if unconfigured): `requiredRole:"admin"` alone is insufficient — a tenant Admin, even the highest in-app RBAC tier, structurally cannot modify the global Plan catalog without also knowing a real deployment-level secret their own JWT never carries. Read routes (list plans, get a plan) stay `requiredRole:"admin"` only, since any tenant admin legitimately needs to see available plans to render an upgrade UI.

**Admin UI — extended, not redesigned.** A new "Billing" section on the existing Settings page (manager+ read visibility, matching every other billing-adjacent GET route's own floor; mutation actions admin-only): current plan name/description/status badge, renewal/trial dates, a real usage-vs-limit progress bar per metered metric (reading the SAME persisted counters the enforcement layer writes), an upgrade dropdown populated from the real Plan catalog, and a cancel-at-period-end button. Built entirely from this app's existing `SettingsCard`/`Badge`/`FilterSelect` components — no new design system.

**Security & concurrency testing — proven, not asserted, per this mission's own repeated "verify over real HTTP, not just unit tests":**

- **34 new unit tests** (`lib/services/billing/*.unit.test.ts`): Plan CRUD/versioning/validation; entitlement self-healing and real capability/limit resolution; usage increment/check/rollback semantics; **two dedicated concurrency races** (20 concurrent requests against a limit of 5 admit exactly 5, converge the persisted counter to exactly 5, never over or under; 30 concurrent requests against a limit of 1 admit exactly 1); full subscription lifecycle (trial start, zero-trial immediate-active, upgrade/downgrade, cancel-at-period-end vs. immediate, resume-cancellation, renewal, trial/grace expiration); real enforcement at the seat/WhatsApp-send call sites (including a mocked-fetch assertion that a denied send never reaches the vendor); and a dedicated two-organization isolation test (Plan A limited vs. Plan B expanded, allowed-vs-blocked capability, usage independently at/over limit per org, limits never cross).
- **7 new Playwright E2E specs** (`tests/e2e/tenantBilling.spec.ts`, real HTTP against the real running server): the platform-secret role-gate ordering (a Manager is rejected before the secret is even checked); an Admin without the secret is rejected; two real Plans created via the real platform-secret-gated route and assigned to two real organizations, each org's own subscription response never mentioning the other's plan id; Org B (has `whatsapp_campaigns`) can create a campaign while Org A (doesn't) gets a real 403; Org A's tiny storage limit rejects a real multipart upload with a real 402, never partially creating a file, confirmed via a before/after file-count check; cancelling Org B's subscription immediately revokes its own capability without touching Org A's; and the 3-tier RBAC floor on the new billing routes (counsellor blocked entirely, manager can read but not mutate).
- **Live-verified against a real MongoDB replica set via an actual logged-in browser session, independently of both test suites**: creating this deployment's own real admin user (via `scripts/createAdminUser.ts`, the very first real interaction with the default organization since this module shipped) triggered the seat-limit check inside `authService.createUser()`, which self-healed the default org onto the `internal-unlimited` plan automatically, with a real `subscription.plan_assigned` audit-log entry recorded before the user was created — proving the self-healing mechanism works in a genuinely unscripted scenario, not just a seeded test. Confirmed directly in MongoDB afterward: a real `plans` collection document (`internal-unlimited`, all 14 capabilities), a real `subscriptions` document referencing it, and the real audit trail. The Settings → Billing panel rendered correctly in a real browser session showing "Internal (Unlimited)" / active / "Team members: 1 / Unlimited" / a real 100-year period-end date — no console errors, no regression on the Leads page or any other existing surface.

**Regression:** 457 unit tests (423 prior + 34 new, all green), 101–103 Playwright specs (93–95 prior + 7 new, both real full-suite runs green apart from the same two pre-existing, already-disclosed flakes — the CRM Settings assignment-rule race and the public Contact-form pointer-interception timing issue — reproduced identically, confirmed unrelated to any file this module touched). `npx tsc --noEmit`, ESLint (scoped to every file this module touched — the full-project `eslint .` surfaces 70 pre-existing issues, all in unrelated marketing-site/legacy files never touched by this pass), and a full production build (including all 8 new billing API routes) all clean.

**Module 8.3 is complete against its own approved scope.** The commercial entitlement layer is real, self-healing (the existing LearnSynaptic organization was never at risk of losing access), concurrency-safe (proven, not assumed), and connected to Module 6.4's existing Payment platform without building a second one. Per this pass's own explicit instruction, Module 8.4 (White-Label & Branding) and 8.5 (WhatsApp Embedded Signup) remain untouched — no public pricing website, no SaaS-onboarding-flow redesign.

---

## Tenant Context & Credentials — Module 8.2 (Post-V1, Phase 8 continues)

**Goal:** the mission's own words — the system must reliably know WHO is making a request, WHICH organization, WHAT role, and WHICH tenant-specific integration credentials may be used, consistently across HTTP requests, background jobs, and every provider adapter — plus a real, centralized, encrypted place to store each organization's own provider credentials, replacing the deployment-wide env vars Module 8.1 left every tenant sharing.

**Module 8.1 re-verified first, per this pass's own explicit "do not trust the previous completion message alone" instruction.** Confirmed directly against the codebase (not just re-read the prior CHANGELOG entry): `tenantScopePlugin` still applied to all 33 Mongoose models, `withApiRoute`'s two-case context resolution unchanged, `runDueScheduledJobs`/`runDueWorkflowSteps` still wrap in `runCrossTenantSweep` before per-job `runWithTenantContext`, `tenantIsolation.spec.ts`'s 6 attack scenarios still pass, full unit (399) and Playwright (88) suites green. No production-critical gap found — the one disclosed 8.1 gap (inbound webhooks land in the default org) was already named as this module's own job, not a defect to fix before starting. Proceeded straight to 8.2.

**Tenant context: reused, not rebuilt.** Every requirement in this section ("one authoritative tenant context," "never trust client-supplied organizationId," "consistently available without redundant re-resolution," "background jobs must always know which org owns the job") was already built by Module 8.1's `lib/tenancy/context.ts`/`withApiRoute.ts`/scheduler-and-automation wrapping — this module adds zero new context-resolution code, only new *consumers* of the existing one. **Membership stays single-org per user**, matching Module 8.1's own `AccessTokenPayload.organizationId` (one claim, not an array) and the existing 3-tier RBAC (counsellor/manager/admin) — the blueprint names no multi-org-per-user requirement anywhere in Phase 8, and inventing one here would be exactly the "do NOT invent" this mission explicitly warned against.

**Centralized tenant credential architecture — one storage/encryption/resolution mechanism for every provider, not a per-vendor bespoke store:**

- **`config/tenantCredentials.ts` + `lib/services/integrations/credentialCrypto.ts`** — a dedicated `TENANT_CREDENTIAL_ENCRYPTION_SECRET` (never reused from Calendar's or Webhooks' own secrets — this project's established "one secret per cryptographic purpose" hygiene since Module 6.3) and the fifth independent copy of this codebase's proven AES-256-GCM `${iv}:${authTag}:${ciphertext}` pattern (tokenCrypto.ts/secretCrypto.ts precedent) — encrypts a plain `Record<string,string>` credential-field map (`encryptCredentialValues`/`decryptCredentialValues`).
- **`IntegrationCredentialRef` gained one new discriminant, `"tenant_secret"`** (`{type:"tenant_secret", encryptedValues: Record<string,string>}`), the same "add a new case, don't repurpose an existing one" precedent `"oauth"` (6.3) and `"webhook_url"` (6.5) already set for this exact union — `"vault"` stays reserved for a real external KMS this app still doesn't have.
- **`lib/services/integrations/credentialResolver.ts`** — `resolveTenantCredential(organizationId, providerId, key)` / `resolveTenantCredentials(...)`: the ONE seam every provider adapter calls instead of reading `process.env`-backed config directly. Always wraps its own repository read in `runWithTenantContext({organizationId})` for the exact id passed in — never the ambient context — so a wrong or forged `organizationId` argument can only ever resolve that one organization's own row, and a missing credential returns `undefined` (never throws, never falls back to another org's value) so the caller's own existing env fallback keeps working unchanged. This is the actual mechanism behind "missing org credential must never fall back to another org's — return a clear config error instead": the resolver structurally cannot see another org's row at all, not merely a runtime check that could be bypassed.
- **`integrationService.setTenantCredentials()`/`clearTenantCredentials()`** — the write path, reusing Module 6.1's existing `IntegrationConnection` registry (`Organization → Provider → Connection → Credentials → Health`) rather than a second integration/credential system: validates, encrypts, upserts the connection's `credentialRef`, writes an `IntegrationLog` row, and records a new `AUDIT_ACTIONS.INTEGRATION_CREDENTIALS_{CONFIGURED,UPDATED,REMOVED}` entry whose metadata carries only the configured KEY NAMES (`{providerId, keys: ["apiKey"]}`), never a value. Deliberately allowed for builtIn providers (WhatsApp/Email/AI) — unlike `connect()`/`disconnect()`/`updateConfig()`, which reject builtIn since those manage a *generic registry connect lifecycle* builtIn providers never had; a tenant credential override is a different, additive capability those providers can have, the entire point of this module.
- **Secret-leak prevention at the API boundary**: `integrationService`'s `toSummary()` now masks every `tenant_secret.encryptedValues` entry to a fixed `"••••••••"` placeholder before it ever reaches a route response — key *names* stay visible (harmless), the AES-256-GCM ciphertext itself never leaves the server. (The pre-existing `"oauth"`/`"webhook_url"` variants already shipped their own ciphertext to API responses since Modules 6.3/6.5, unused by the frontend but present on the wire — a real, pre-existing gap, disclosed here rather than silently carried forward or fixed outside this module's own scope.)

**Providers wired to the resolver — real, end-to-end, not just the storage layer sitting unused:**

- **AI (OpenAI/Anthropic/Gemini)** — `isAiProviderConfigured()` (`lib/services/ai/registry.ts`) and all three `*.provider.ts` adapters now resolve `getTenantContext()?.organizationId` and check `resolveTenantCredential(orgId, providerId, "apiKey")` before falling back to the env-configured key. Proven with a real request assertion, not just that the resolver function exists in isolation: `credentialResolution.unit.test.ts` mocks `fetch` and asserts the outbound `Authorization` header actually carries the tenant's own key (env is deliberately blank in the test environment, so success is only possible via the tenant path).
- **Email (Postmark)** — `postmark.provider.ts`'s `.send()` resolves both `serverToken` (credential) and `fromAddress` (a real per-tenant business fact, not just a secret — Org A's mail must come from Org A's own verified sender) before falling back to env. SendGrid/Resend stay unwired (still scaffold-only `NotImplementedError` adapters, unrelated to this module).
- **WhatsApp (Meta Cloud API), outbound only** — all 8 async/outbound methods (`sendText`/`sendTemplate`/`sendInteractiveButtons`/`sendInteractiveList`/`sendMedia`/`resolveMediaUrl`/`listTemplateApprovalStatuses`/`getPhoneNumberHealth`) resolve `accessToken`/`phoneNumberId`/`businessAccountId` via one shared `resolveEffectiveConfig()` before falling back to env. **Inbound webhook verification (`verifyWebhookChallenge`/`parseWebhookEvent`/`parseInboundMessages`) deliberately stays env-only, a disclosed gap, not an oversight**: those methods are synchronous (part of `WhatsAppProvider`'s own shared interface, common to every vendor adapter), and more fundamentally, verifying an inbound signature requires knowing WHICH organization's app secret to check *before* the payload can even be parsed to find out — this app has one global `/api/webhooks/whatsapp` endpoint with no per-tenant routing segment yet. Real per-tenant inbound WhatsApp app credentials need genuine webhook-routing design (matching `phoneNumberId` → connection → organization ahead of signature verification), which is squarely Module 8.5's job (WhatsApp Embedded Signup, explicitly out of scope here), not a corner cut in this pass.
- **Storage/Calendar/Payments/Webhooks/Notifications — NOT wired this pass, disclosed rather than claimed uniform.** The full storage/encryption/resolver/UI architecture applies to any of them unchanged (a future adapter only needs to call `resolveTenantCredential`), but their own provider adapter files don't call it yet — offering the admin UI's credential form for them would let an admin "configure" a credential no code ever reads, a worse outcome than not offering it; the UI form (`TenantCredentialsForm`) is deliberately gated to only the 5 providers actually wired (`whatsapp`, `email`, `openai`, `anthropic`, `gemini`).

**Env var migration — backward-compatible by construction, nothing broken, nothing deleted.** Every wired adapter's precedence is "tenant credential first, existing env var always the fallback" — a deployment with no tenant credential configured for any org behaves byte-for-byte as before this module shipped. No env var was removed or renamed; `config/whatsapp.ts`/`config/emailChannel.ts`/`config/aiInsights.ts` are untouched. LearnSynaptic's own existing operational config continues serving the default organization exactly as it did under 8.1.

**Admin UI — extended, not redesigned.** `TenantCredentialsForm` (new) adds one real write capability to the existing, previously fully-read-only builtIn `IntegrationCard` branch: a masked key-value form (`type="password"` inputs, provider-specific field labels — e.g. WhatsApp's 3 fields vs. OpenAI's 1) with Configure/Update/Remove actions calling two new routes, `PUT`/`DELETE /api/admin/integrations/[providerId]/credentials` (`requiredRole: "admin"`, the same tier every other integration-lifecycle route already enforces — Counsellor/Manager have no credential-management capability, matching the mission's own permission section without new RBAC code). A configured provider shows **"(configured — overrides environment config)"**; the field always starts blank on "Update" (the server never returns a real value to prefill) and saving replaces the full field set for that provider — the same "replace, not merge" semantics `updateIntegrationConfig()` already established for non-builtIn config. No organization switcher, no white-labeling, no billing UI — none of that is this module's job.

**Security testing — real, not asserted, per this mission's own "prove tenant credential isolation" instruction:**

- **Unit** (`credentialCrypto.unit.test.ts`, `credentialResolver.unit.test.ts`, `setTenantCredentials.unit.test.ts`, `credentialResolution.unit.test.ts` — 24 new tests): encrypt/decrypt round-trip and tamper detection; two organizations configuring the same provider each resolve only their own value; a resolver call's `organizationId` argument wins over an unrelated ambient tenant context (proving the resolver can't be tricked by whatever happens to be active); audit/log entries carry only key names; a real outbound HTTP request actually carries the tenant's key in its `Authorization` header.
- **E2E, real HTTP, two real organizations** (`tests/e2e/tenantCredentials.spec.ts`, 7 new specs): Manager gets 403 on both routes; validation rejects empty/non-string values; Org A configures a Slack webhook secret, Org B (a fully distinct admin session/organization) sees the provider as never-connected — not Org A's value, not even a masked hint that one exists — and Org B's own attempt to clear a credential it never configured fails with the real `not_connected` error, never a false success; every response body across the whole spec is asserted, via `JSON.stringify`, to never contain the raw configured secret; the Logs endpoint is asserted to contain the configured key name but never the value.
- **Live-verified against a real MongoDB replica set via an actual logged-in browser session** (not just Playwright's in-memory suite): configured a real OpenAI tenant credential through the live Settings UI, confirmed the card updates to "configured — overrides environment config," confirmed the credential field starts blank on "Update" (server never returns the real value), removed it and confirmed it reverts to "using environment config." Queried MongoDB directly afterward: `integrationconnections` shows the real, organization-stamped row; `auditlogs` shows all three lifecycle events (`configured`→`updated`→`removed`) with metadata containing only `{providerId, keys}`, confirming no secret reached the database's own audit trail either, not just the API response.

**Regression:** 423 unit tests (399 prior + 24 new, all green), 96 Playwright specs (88 prior + 7 new tenant-credential ones + net calendar-spec stabilization, 94 passed on the final run) — the same two pre-existing, already-disclosed flakes (CRM Settings assignment-rule race; a UI-overlay pointer-interception timing issue on the public Contact form) reproduced identically in isolated reruns, confirmed unrelated to any file this module touched. `npx tsc --noEmit`, ESLint, and a full production build (`next build`, including the two new API routes) all clean.

**Module 8.2 is complete against its own approved scope.** The centralized tenant credential architecture is real, encrypted, resolver-mediated, and proven isolated end-to-end (unit, E2E, and live real-database verification) for 5 of this app's currently-implemented providers (WhatsApp outbound, Email, OpenAI, Anthropic, Gemini); Storage/Calendar/Payments/Webhooks/Notifications have the same architecture available but are disclosed, not silently claimed, as unwired follow-on work, alongside WhatsApp's inbound-webhook per-tenant-routing gap (both explicitly named as Module 8.5's job). Per this pass's own explicit instruction, Module 8.3 (Billing/Plans/Feature Flags), 8.4 (White-Label/Branding), and 8.5 (WhatsApp Embedded Signup) remain untouched — no pricing plans, subscriptions, SaaS checkout, or white-label functionality was added.

---

## Tenant Data Isolation — Module 8.1 (Post-V1, Phase 8 OPENS)

**Goal:** the mission's own words — real, server-enforced multi-tenant data isolation, not the Phase 0 `organizationId` scaffolding every model has carried unused since this build's very first pass. "Do NOT pretend the application is multi-tenant simply because schemas contain organizationId. The objective of this module is REAL server-enforced tenant isolation." The highest-blast-radius module in this entire 35-module blueprint by explicit design.

**Audited first, per the mission's own explicit instruction not to touch code until the blast radius was understood.** 36 Mongoose models; 33 already carried an optional `organizationId` field from Phase 0, 2 (`PhoneNumber`, `WebhookDelivery`) had none at all, 1 (`Organization`) is the tenant root itself. Of 73 repository files (37 entities × in-memory/MongoDB pairs), only 8 referenced `organizationId` anywhere, and none of those enforced it as a real query filter — every read/write in the app was, in practice, fully cross-tenant. This confirmed the mission's own framing was accurate, not overstated.

**Architecture — one mechanism, two implementations, never developer discipline at 300+ call sites:**

- **`lib/tenancy/context.ts`** — a Node `AsyncLocalStorage<TenantContext>` (`{organizationId, userId?, role?}`), the single authoritative tenant-context source. `runWithTenantContext()` establishes it (called from exactly two places: `withApiRoute.ts`, once per request, and the scheduler/automation-engine job-processing loops, once per job/run); `getTenantContext()` reads it; `runCrossTenantSweep()` (Node's own `AsyncLocalStorage.exit()`) is the explicit escape hatch a background sweep needs to see every organization at once, even when triggered from inside an already-tenant-scoped admin request.
- **`lib/db/tenantScopePlugin.ts`** — a Mongoose plugin (`schema.plugin(tenantScopePlugin)`) applied to all 33 tenant-owned models (one line each): `pre` hooks on every query method (`find`/`findOne`/`findOneAndUpdate`/`updateMany`/`deleteMany`/`countDocuments`/`distinct`/etc.) merge `{organizationId}` into the filter automatically whenever a context is active; `aggregate` gets a `$match` stage unshifted onto its pipeline; `save`/`insertMany` overwrite whatever `organizationId` a caller supplied with the trusted context value — the mission's own "do NOT accept organization ownership from untrusted client input," satisfied by construction. A cross-tenant `findById` simply returns `null` — the exact same response a genuinely nonexistent id produces, never a distinguishing 403 that would itself leak "this id exists, just not for you" (the mission's own "cross-tenant IDs should behave safely according to existing API conventions").
- **`lib/db/inMemoryTenantScope.ts`** — the same contract for the in-memory store (`scopeToTenant`/`findOwnedByTenant`/`stampTenant`), since this app's ENTIRE unit and Playwright suite runs against in-memory repositories (no ORM to hook into), applied to all ~35 in-memory repositories.
- **Fail-open with no context, by design, not oversight.** Every scoping hook is a no-op when `getTenantContext()` returns `undefined` — scripts, migrations, and any code that predates this module keep working exactly as before. Real protection comes from `withApiRoute.ts` unconditionally establishing context for every request that reaches a handler (see below), not from a database-level guarantee independent of the app calling it correctly. Disclosed explicitly, not claimed as an absolute.
- **Deliberately NOT scoped**: `User`, `RefreshToken`, `Organization` (the tenant-membership/tenant-root entities themselves — login must find a user by email before an org is even known) and `ScheduledJob` (a genuinely cross-tenant system queue by nature — see below).

**Tenant context resolution — real identity, never trusted from the client:**

- `AccessTokenPayload` gained `organizationId`, resolved once at login/refresh from the authenticating `User.organizationId` (falling back to the deployment's default organization), carried in the JWT the same way `role` already was — fast, Edge-runtime-safe, same "takes effect on next login" trade-off `role` changes already accept.
- `middleware.ts` forwards a new trusted `x-auth-org-id` header (stripping any client-sent copy first, identical to the other three) — but only when the verified token actually carries one.
- **`withApiRoute.ts` distinguishes two genuinely different "no organizationId" cases**, the one design decision this module iterated on most: (1) **not authenticated at all** (no valid session) — establishes no context; public routes' own services (`leadService.registerLead`, `registrationService`'s public create, `webhookMonitoringService.logDelivery`, `paymentService.handleProviderWebhook`) stamp the deployment's default organization explicitly themselves, since a provider's inbound webhook or an anonymous form submission has no session to derive identity from at all. (2) **authenticated, but the token carries no org claim** (a legacy/test-minted token) — resolves the real default organization server-side, the same one `authService`'s own login flow resolves, never a second, disconnected fake default. Getting this distinction wrong (an earlier iteration forced a default org onto every unauthenticated request) silently broke every direct-service-call unit test that seeds its own data with no context and expects to find it again — caught by the full regression suite, not shipped.

**Cross-entity reference integrity, relational consistency across Lead↔Task/Activity/Opportunity/Conversation, Campaign↔Message, Payment↔Registration, Workflow↔Lead, File↔Entity, Integration↔Organization**: achieved by construction, not a second validation layer. Every write already looks up its referenced entity through the same tenant-scoped repositories; a reference to another organization's record simply fails to resolve (the same `null`/not-found behavior every cross-tenant read already has), so a cross-tenant relationship can never be created in the first place.

**Background processing — the mission's own "critical" callout.** `runDueScheduledJobs()` (the shared scheduler — every job type in this app, including Campaign send, template sync, phone health check, payments reconcile, webhook retry/dead-letter, all flow through this one queue) and `runDueWorkflowSteps()` (the automation engine's separate WorkflowRun poller) both: (1) `runCrossTenantSweep()` first, escaping any context inherited from a real admin manually clicking "Run Due Jobs Now" (`withApiRoute` would otherwise silently scope the whole sweep to just that admin's own organization, leaving every other tenant's due work unprocessed with no error); (2) resolve and enter each individual job/run's own real tenant context, stamped at enqueue time by `enqueueJob()`, before that one job's actual processing — never a worker touching tenant-owned data with the wrong (or no) context. `findDue`/`findStalePending`-style cross-tenant sweep queries themselves stay deliberately unscoped (their whole job is seeing every organization at once).

**Analytics and AI isolation are automatic, not a separate mechanism.** Every Phase 7 analytics service and every Phase 5 AI service (lead scoring, insights, AI replies, conversation analytics) reads exclusively through the same tenant-scoped repositories, and only ever runs inside an already-established context (an authenticated admin route, or an automation step running inside its own run's real context) — verified directly (`leadInsightService.analyzeLead()` traced end to end) rather than assumed.

**Index migration**, inspected per the mission's own "do NOT blindly modify indexes" instruction: `campaign.code`, `customFieldDefinition.key`, `tag.label`, and `integrationConnection.providerId` moved from globally-unique to `{organizationId, field}` compound-unique — real internal business keys where two organizations legitimately having the same value (two "SUMMER24" campaigns, two orgs each connecting their own Razorpay) is the whole point of real multi-tenancy. `conversation`'s two partial-unique contact indexes gained a leading `organizationId` too. Left deliberately unchanged, disclosed rather than blindly touched: `organization.slug` and `refreshToken.tokenHash` (correctly global — the tenant identifier itself and a bearer credential, not business data), `user.email` (a real product decision belonging to Module 8.2's own "Tenant Context & Credentials," not this one — changing login-by-email semantics is out of this module's scope), `phoneNumber.phoneNumberId` (a real external WhatsApp Business Account identifier, genuinely globally unique in the real world, not an internal key), `registration`'s own `leadId+programSlug` compound (already relationally safe via `leadId`'s own tenant scoping). One representative compound performance index (`lead: {organizationId, createdAt}`) added — a full pass across all ~80 indexes for the same optimization is a disclosed follow-up, not claimed complete.

**Migration/backfill** (`scripts/backfillOrganizationId.ts`): assigns the deployment's default organization to every existing record across all 32 tenant-owned models still missing `organizationId`. Idempotent (filtered to `organizationId: {$exists: false}`, verified via three consecutive real-MongoDB runs: 0 backfilled on a clean DB → 1 backfilled after seeding a raw legacy-shaped document → 0 backfilled again, confirming no double-write), observable (per-collection counts printed, a matched-vs-modified mismatch warned explicitly rather than swallowed), safe (no destructive operation — only ever sets a previously-absent field).

**Security testing — real, over-HTTP, not just unit tests, per the mission's own explicit "do not consider this module complete based only on unit tests."** `tests/e2e/tenantIsolation.spec.ts`: two real, distinct organizations, real data created through the real admin API as Org A, real cross-tenant attacks attempted as Org B for each — read/update/delete/bulk-op/list a lead by id, access a task by id, use another org's connected integration (proving `providerId` is genuinely per-tenant unique now), aggregate analytics (zero leak), see another org's WorkflowRun history (zero leak), and a dedicated check that an Org B **admin** (the single highest RBAC tier) gets the exact same 404 a manager/counsellor would — proving tenant isolation and RBAC are independent mechanisms, never conflated. Every attack fails. Payment (no connected real gateway in this test environment — Module 6.4's own established constraint), FileAsset (multipart upload, out of scope for this pass's HTTP-JSON suite), and Conversation (no direct admin-authenticated creation endpoint — only ever created from an unauthenticated inbound webhook, itself a disclosed gap, see below) are covered by the same underlying repository mechanism, proven directly against real MongoDB, but not by a dedicated flow in this file — disclosed, not silently narrowed.

**Live-verified twice against a real MongoDB replica set, independently of the Playwright suite (which runs in-memory):** (1) a standalone script proving the Mongoose plugin directly — create-time stamping overwrites a deliberately-wrong client-supplied `organizationId`, cross-tenant read/update/delete all correctly return null/no-op, list excludes the other tenant's record, and a no-context read still succeeds (fail-open confirmed); (2) a real logged-in browser session against two real organizations with two real admin accounts (`qa-org-a-admin-*`/`qa-org-b-admin-*`, both deleted afterward): Org A's own lead list correctly shows a lead seeded under its real organization id; logging out and into Org B shows an empty list; navigating directly to Org A's lead by its real MongoDB `_id` renders the app's own genuine "Lead not found" page — the same page a truly nonexistent id would show, confirmed visually, not just asserted in a test.

**One disclosed gap, real and load-bearing, not swept under the "single-tenant-in-practice" framing:** inbound webhook processing (WhatsApp/email/payment providers) is genuinely unauthenticated by design (a provider's servers have no LearnSynaptic session), so it cannot resolve which organization a webhook belongs to from the request itself — every inbound webhook is stamped with the deployment's one default organization, correct today (this app has exactly one connected BSP/payment account) but not yet real per-org routing. Resolving that is explicitly Module 8.2's job ("Tenant Context & Credentials"), not this one's.

**Regression:** 399 unit tests (unchanged — no test in that suite establishes tenant context, so none of it exercises the new scoping paths, by design), 88 Playwright specs including 6 new tenant-isolation ones, full suite green on every rerun; the same two pre-existing, already-disclosed flakes (CRM Settings assignment-rule race; the pre-existing uncommitted `app/contact/page.tsx`/`ContactForm.tsx` changes predating this module) confirmed clean/unrelated on isolated rerun, their own underlying code inspected fresh this pass and found to carry no tenant-scoping bug. `npx tsc --noEmit`, ESLint, and a full production build all clean.

**Admin UI:** untouched beyond what already existed — no organization switcher, no tenant-onboarding flow, no per-org branding, per the mission's own explicit "Module 8.1 is primarily an isolation/security architecture module... do NOT add organization switching unless that belongs to Module 8.2... do not prematurely build SaaS signup/plans/onboarding/white-labeling."

**Module 8.1 is complete against its own approved scope — real tenant isolation is enforced end to end and proven, not asserted.** Phase 8 (Multi-Tenant SaaS) is now open; per this pass's own explicit "do NOT begin Module 8.2" instruction, no further module was started. 8.2 (Tenant Context & Credentials — real per-org provider connections, real per-org public routing for Lead/webhook capture) is the direct, unblocked next module in this phase; 8.3 (Billing/Plans/Feature Flags), 8.4 (White-Label/Branding), and 8.5 (WhatsApp Embedded Signup/Org Console) remain untouched.

---

## Executive Dashboard — Module 7.3 (Post-V1, Phase 7 COMPLETE)

**Goal:** the mission's own words — a premium owner-level command center where a business owner opens ONE dashboard and immediately understands "what is happening in my business right now, why is it happening, and what needs my attention," primarily by COMPOSING Module 7.1's (Counsellor & Pipeline Analytics) and Module 7.2's (Automation & Revenue Analytics) already-shipped analytics rather than building a competing analytics system.

**Resumed, not started fresh.** A prior session in the same day had already built the Action Center's own backend slice (`lib/services/executiveDashboard/actionCenterService.ts`, `GET /api/admin/executive/action-center`) per an explicit "Implement ONLY Phase 7 — Module 7.3 Executive Dashboard, do NOT begin Phase 8" mission, but stopped mid-module — no dashboard composition service, no route, no UI, no tests, no CHANGELOG/audit entry. This pass verified that slice was genuinely solid (real, well-scoped code — 8 real Action Center categories, each a thin composition over an already-existing list/read operation) and built everything else on top of it rather than redoing it.

**Built:**

- **`executiveSummaryService.getExecutiveDashboard(range)`** (`lib/services/executiveDashboard/`) — composes, in one `Promise.all`: Module 7.2's `getRevenueMetrics`/`getRevenueGrowth`/`getRevenueTrend`/`getCrmRevenueFunnel`/`getRevenueAttribution`/`getCounsellorRevenueStats`/`getCampaignRoi`/`getWhatsAppRevenue`, Module 7.2's automation-analytics `getAutomationAnalytics`/`getWorkflowPerformance`, plus three small genuinely-new live snapshots (`pipelineService.listOpportunities` by status, `leadService.listLeads` by health, `paymentService.getAnalytics()`). Every field is either an existing 7.1/7.2 result passed through verbatim, or a pure aggregation over data already fetched for this same response — never a second, independently-computed version of a number another module already owns.
- **Executive KPI Layer** — Total Leads/Conversions/Conversion Rate read directly off the funnel's own `leadsCreated`/`registrationsConfirmed` stages (never a second lead count); Collected/Expected/Pipeline/Avg-Deal Revenue and Payment Success Rate straight from `RevenueMetrics`; Open/Won/Lost Opportunities as a live, all-time snapshot (`pipelineService.listOpportunities` by status) — deliberately distinct in scope from the range-scoped Won/Lost *Revenue* figures already in `RevenueMetrics`, never conflated into one KPI. **Qualified Leads is a disclosed proxy, not a fabricated status:** this app's `LeadStatus` enum has no literal "Qualified" value (the same gap `CrmFunnelResult`'s own module doc already discloses for its funnel) — Qualified Leads counts leads currently banded `hot`+`warm` by `lib/services/crm/scoring/health.ts`'s existing `bandHealth()`, the one real proxy this data model supports.
- **WhatsApp Health** (`ExecutiveWhatsAppHealth`) — a pure sum over `WhatsAppRevenueResult.campaigns` (already fetched for Campaign Performance), never a second Message query; delivery/read/reply rates computed with the identical formula `whatsappRevenueTypes.ts`'s own per-campaign rate fields already use, just applied account-wide.
- **Payment Health** (`ExecutivePaymentHealth`) — a thin reshape of `paymentService.getAnalytics()` (Module 6.4), not a second Payment query; deliberately labeled "All-Time Collected" to avoid conflating it with the range-scoped `ExecutiveKpis.collectedRevenueInr` sitting right next to it on the same page.
- **`GET /api/admin/executive/dashboard`** — `requiredRole: "admin"`, matching `/api/admin/analytics/revenue`'s own gate for the identical "account-wide revenue payload" reasoning. Kept deliberately separate from the pre-existing `/api/admin/executive/action-center` route (different question — "what needs attention" vs. metrics/charts — the two sections already render independently on the page), per the mission's own "do NOT create one huge endpoint" instruction.
- **`app/admin/executive` page** — the flagship dashboard: Action Center ("Needs Attention," clickable category cards linking to the real owning page/filter), Executive KPIs, Revenue Overview (collected-revenue trend chart + Won/Lost Revenue), Sales Funnel (`FunnelViz` over the real Lead→Enrolled stages), Counsellor Performance and Campaign Performance (**condensed top-5-by-revenue views with a "View full analytics/breakdown" drill-through link to the existing, already-complete tables on `/admin/analytics`** — the mission's own explicit "do NOT duplicate the Counsellor Analytics module... provide drill-through/navigation" instruction, not an oversight), WhatsApp Health, Automation Health (including a real "Workflows Needing Attention" table sorted by failure count, and a "Best Performer" tile sorted by revenue influenced), Payment Health. Built entirely from the existing design system (`StatCard`/`Table`/`FunnelViz`/`TrendLine`/`DateRangePicker`/`Badge`/`DataStates`/`Skeleton`) — no new visual components, per the mission's own "do NOT redesign the admin dashboard" instruction. Every domain-service import in this client component is `import type` (never a value import from a barrel that pulls in `lib/db`→mongoose) — the exact client-bundle trap Module 3.2 and 6.3 each hit reactively is avoided here proactively.
- **Nav entry** (`/admin/executive`, `Gauge` icon, `minRole: "admin"`) had actually already been added by the interrupted prior session and needed no changes.

**Known limitations, disclosed rather than silently hidden (mission's own §"KNOWN LIMITATIONS"):** the automation retry-rate undercount and WhatsApp last-touch attribution caveats already documented for Module 7.2 apply unchanged here, since this module only ever displays those same figures. `organizationId` remains unpopulated app-wide — this module does not implement Phase 8 tenant isolation, per the mission's own explicit instruction not to.

**QA:** Production build, `npx tsc --noEmit`, ESLint all clean on every file this module touched (confirmed zero output from a full-repo lint targeted at just these files). 6 new unit tests (`executiveSummaryService.unit.test.ts`) verify the composition never drifts from its own sources — `kpis.totalLeadsInRange`/`conversionsInRange`/`conversionRatePct` asserted byte-identical to the funnel's own stage values on every run, the opportunity KPI trio asserted identical to live `pipelineService.listOpportunities` counts, WhatsApp/Payment Health rate math verified against real seeded campaign counters and Payment rows (including a null-not-zero check on an empty date range) — full suite now 399 unit tests (up from 393), zero regressions. 5 new Playwright specs (`executive-dashboard.spec.ts`) cover full-page render, date-range re-fetch, Action Center navigation, and RBAC three ways over real HTTP (401 unauthenticated / 403 manager / 200 admin) for both new routes — full suite 88 Playwright specs (up from 83), with the same two pre-existing, already-disclosed flakes (CRM Settings assignment-rule race; the pre-existing uncommitted `app/contact/page.tsx`/`ContactForm.tsx` changes from a prior session) confirmed clean on isolated rerun, unrelated to this module.

**Live-verified in a real logged-in browser against a real MongoDB replica set** — a disposable `qa-verify-73@learnsynaptic.internal` admin account and a handful of disposable Leads/Opportunities/Payments/WhatsApp-campaign rows were seeded through the real service layer, the dashboard was loaded and scrolled through in full, and every section's numbers were confirmed to exactly match the seed (₹75,000 Collected Revenue, 50% Payment Success Rate = 1 succeeded/2 total, 2 Qualified Leads = 1 hot + 1 warm, 84%/71% WhatsApp delivery/read rates = 42/50 and 30/42 exactly, Automation Health correctly showing em-dashes rather than fabricated zeros with no workflows yet). Clicking the "Hot Leads Awaiting Follow-up" Action Center card correctly navigated to `/admin/leads?health=hot`. No console errors other than a browser-extension-injected hydration attribute (`cz-shortcut-listen`) — a known, environment-only false positive, not an app bug. All seed data and the disposable admin account were deleted afterward, following this project's own established disposable-QA-account pattern.

**Module 7.3 is complete against its own approved scope. Phase 7 (Enterprise Analytics) is now FULLY COMPLETE — all three modules (7.1 Counsellor & Pipeline Analytics, 7.2 Automation & Revenue Analytics, 7.3 Executive Dashboard) at spec.** The third Post-V1 phase (after 5 and 6) to close out entirely. Phases 0–7 are all now fully complete; only Phase 8 (Multi-Tenant SaaS) remains fully unbuilt anywhere in the 35-module blueprint. Per this pass's own explicit "do NOT begin Phase 8" instruction, no further module was started — opening Phase 8 is a genuine product/investment decision (the highest blast-radius option in the entire blueprint — zero cross-tenant test coverage exists anywhere in this codebase today), worth a real confirmation rather than an autonomous pick.

---

## Automation & Revenue Analytics — Module 7.2 (Post-V1, Phase 7 continues)

**Goal:** the mission's own framing — connect Marketing → Leads → CRM → Counsellors → Conversations → Automations → Opportunities → Payments → Revenue, so a business owner can answer "what is generating revenue," not just "how many leads did we get." Reuses Module 7.1's counsellor/pipeline analytics and Module 1.6's Leaderboard unchanged, Module 6.4's Payment collection as the one real-money source of truth, Module 3.1's WorkflowRun as the one automation-execution source of truth — no second analytics database, no competing revenue calculation.

**Verified first, per the mission's own explicit instruction to check before building.** Confirmed Phase 6 (Integrations Hub) is genuinely complete — all five modules (6.1–6.5) at spec, both in the previously-published Implementation Audit and independently re-derived from the live codebase this pass. Confirmed Module 7.1 (Counsellor & Pipeline Analytics) is complete against its own approved scope — `pipelineAnalyticsService.ts` correctly derives counsellor win-rate/pipeline-value and per-pipeline stage funnels from real Opportunity/stageHistory data, with no incomplete production-critical work — so this pass built Module 7.2 fresh rather than finishing 7.1, and deliberately never modified 7.1's own files (mission's own "do NOT duplicate — extend where required" instruction), only wrapping its output from a new file.

**Built:**

- **A real `workflowRunId` attribution chain**, the one schema change this module's own honesty required: `WorkflowContext` gained a `runId` field (engine.ts's own `advanceWorkflowRun` now passes `run.id`), and `Message`/`Task` gained an optional `workflowRunId`, stamped only by the automation engine's own `sendWhatsAppTemplate`/`sendEmail`/`createTask` executors. Without this, "automation-generated messages/tasks" could only ever be guessed at (a manual compose reply is also `campaignId`-less) — with it, the count is a real join, not an inference. `hasWorkflowRunId` boolean filters added to `MessageListFilters`/`TaskListFilters` for the account-wide rollup, avoiding an N+1 per-run query.
- **Automation Analytics** (`lib/services/automation/analytics/`) — executions, active/total workflow definitions, a full run-status breakdown, success/failure/retry rate, a day-bucketed trend chart, and a derived (not logged — no action-execution ledger exists) `actionExecutionVolume`. Two limitations disclosed directly in the module's own doc comment rather than silently oversold: retry rate reflects only the run's own *last* step (`WorkflowRun.attempts` resets to 0 on every step advance, so earlier-step retries aren't recoverable from the persisted row), and this app's automation engine has no separate "dead letter" state — every terminal `"failed"` WorkflowRun already means retries were exhausted, so `deadLetterCount` is an alias for `runsByStatus.failed`, not a second counter pretending to be a different concept.
- **Workflow Performance**, per definition — runs/successes/failures/conversions/leads affected/messages/tasks, plus revenue **influenced** (any succeeded payment for a lead this workflow ran against, on/after the run started — correlation) versus revenue **attributed** (stricter: only runs whose `completionReason` is `"converted"`, the one real signal the event bus already produces when `triggers.ts`'s own `registration.created` handler stops an active run early). `lastExecutionAt` is deliberately unscoped by the selected date range (answers "when did this last run," not "did it run in this window").
- **Revenue Analytics** (`lib/services/revenueAnalytics/`) — Collected/Net/Refunded (Payment-derived, the exact status-bucket definition `paymentService.getAnalytics()` already established) alongside Expected/Pipeline/Won/Lost/Avg-Deal (Opportunity-derived, the exact `expectedRevenueInr` definition Module 7.1 already established) — reported as two genuinely different numbers (forecast vs. real cash), not a fabricated single "Total Revenue." Revenue Growth compares the selected range against the immediately-preceding period of equal length. Non-INR succeeded payments are excluded from every INR sum and surfaced separately, never force-converted.
- **Revenue Attribution**, one consistent DIRECT/INFLUENCED rule across nine dimensions: DIRECT means the key was recorded on the Payment row itself at checkout time (Marketing Campaign via `Payment.campaignId`, Pipeline via `Payment.opportunityId`); INFLUENCED means it's joined through `Payment.leadId` after the fact (Lead Source, UTM Source/Medium/Campaign, Program, Counsellor, WhatsApp Campaign via a disclosed "last touch before payment" rule). Every dimension separately reports `unattributedInr` so a caller can verify rows + unattributed always equals the range's own total collected revenue — nothing silently dropped.
- **The extended CRM Funnel** — Lead → Opportunity Created → Opportunity Won → Payment Succeeded → Registration Confirmed ("Enrolled"), using this app's own real cross-entity events end to end, not the mission's own suggested "Qualified"/"Counselling" labels (no such literal `LeadStatus` exists — fabricating one would have violated this module's own "use the actual stages implemented" instruction). Avg-time-in-stage uses real id joins per transition (`Opportunity.leadId`, `Opportunity.stageHistory`, `Payment.opportunityId`, `Payment.registrationId`) where resolvable, null otherwise — never a fabricated average over an empty set.
- **Counsellor + Revenue** — merges 1.6's Leaderboard and 7.1's Pipeline Analytics fields **unchanged**, adding only `revenueInr` (via the identical Opportunity.ownerId-falling-back-to-Lead.assignedCounsellorId rule 7.1 already uses) and `conversationsAssignedCount` (genuinely new — neither prior module reads Conversation).
- **Campaign ROI** — real per-campaign revenue is now possible for the first time (`campaignMetrics.ts`'s own long-disclosed "per-campaign ROAS always null" gap, closed now that `Payment.campaignId` exists). Spend prefers a connected AdsProvider's real figure, falling back to the pre-existing `Campaign.budgetInr` field with an explicit `spendSource` flag distinguishing "confirmed ad spend" from "planned budget" — never presented identically.
- **WhatsApp Performance + Revenue** — reuses `WhatsAppCampaign`'s own real sent/delivered/read/failed/reply counters verbatim; revenue/conversions reuse the same last-touch attribution join computed once by the Attribution service, not re-derived. `leadsGenerated` is always `null`, not a fabricated 0 — this app's WhatsApp campaigns message existing Leads, they don't create new ones.
- **Automation ROI** — a thin, explicitly-labeled reshape of Workflow Performance into the mission's own §9 vocabulary, plus one new figure (account-wide totals) with a doc comment disclosing they're plain per-workflow sums, not deduplicated (a lead active in two workflows is counted in both).
- **Date Filtering, IST-anchored** (`dateRanges.ts`) — Today/Yesterday/Last 7/Last 30/This Month/Previous Month plus Custom Range, every boundary computed against Asia/Kolkata (this business's real operating timezone, the same anchor `lib/cohortDate.ts` already uses for cohort scheduling), not server UTC. Deliberately full ISO start/end-of-day instants rather than the date-only convention `/api/admin/marketing` already uses — that route's own `to` boundary silently excludes almost all of its own last day once compared against a full timestamp; this module's boundaries avoid repeating that gap.
- **One consolidated route**, `GET /api/admin/analytics/revenue` (`requiredRole: "admin"`, matching the Marketing Dashboard's own gate for the identical "aggregates account-wide revenue" reasoning), composing all ten services in parallel — the same "a dashboard fetches all of these together" precedent `/api/admin/marketing` and `/api/admin/analytics` already established. `?format=csv&section=...` reuses `lib/api/csv.ts`'s existing `toCsv()` for Workflow Performance/Attribution/Campaign ROI/WhatsApp/Counsellor exports — no reporting engine.
- **Admin UI** extends the existing `/admin/analytics` page (its own date range, independent of the Marketing Dashboard's own from/to fields above it) — new `DateRangePicker`/`TrendLine` components matching the established design system exactly (StatCard/Table/FunnelViz/DonutStat/Recharts+ChartTooltip/CHART_PALETTE), every section with real loading/empty/error states, an attribution-dimension selector, and Export CSV buttons on every tabular section.
- **Organization isolation:** every new service reads through the same repositories every other module already uses — `organizationId` remains disclosed, schema-level scaffolding, unpopulated everywhere in this app (Modules 6.1–6.5's own carried-forward state), not silently pretended otherwise.

**QA:**

- Production build, `npx tsc --noEmit`, ESLint: all clean on every file this module touched.
- 38 new unit tests: IST day/month boundary math (11, including a real year-boundary crossing case for Previous Month); Automation Analytics' status/retry/dead-letter/action-volume derivation driven through the real engine (`startWorkflowRun`/`advanceWorkflowRun`), not hand-built WorkflowRun fixtures; Workflow Performance's influenced-vs-attributed split (the core new claim — a normally-completed run's later payment is influenced-only, a `"converted"`-stopped run's payment is both, a payment predating the run is neither); Revenue Analytics' collected/refunded/net/won/lost/growth math against real seeded Payments and real `moveStage()` transitions; Attribution's DIRECT-vs-INFLUENCED classification against a real Campaign and a real Lead; the extended Funnel's real stage counts and its own "never double-count Enrolled's revenue" guarantee; smoke tests confirming Campaign ROI/WhatsApp/Counsellor/Automation ROI compose correctly. Full existing suite re-run clean: 393/393 (up from 355), zero regressions.
- **Live-verified in a real logged-in browser against the real MongoDB replica set** (after a full dev-server restart — this pass's own new Mongoose fields don't take effect under Fast Refresh, the same lesson recorded from Module 6.3). Every new section rendered with real, correctly-computed data (19 real executions, 75%/25% success/failure rate, a real recharts trend chart, two real workflow rows with real revenue-influenced figures, ₹90,000 real pipeline value, a real 8%-conversion Enrolled funnel stage, a real ₹50,000-budget Campaign ROI row correctly showing −100% ROI at ₹0 revenue). Date-range presets, the attribution-dimension selector, and CSV export were exercised live and confirmed correct (`?format=csv&section=workflows` returned real, correctly-headered CSV). RBAC confirmed three ways over real HTTP: unauthenticated → 401, `manager` role → 403 "Access denied", `admin` role → 200. No regressions on 7.1's own Counsellor & Pipeline Analytics section or any other existing page content.
- **Module 7.2 is complete against its own approved scope.** Phase 7 (Enterprise Analytics) now has 7.1 and 7.2 shipped; 7.3 (Executive Dashboard) remains explicitly not started, per this pass's own "do NOT begin 7.3" instruction. Phases 0–6 and 8 are unchanged by this pass.

---

## Payments Integration — Module 6.4 (Post-V1, Phase 6 continues — five of five modules now shipped, Phase 6 complete)

**Goal:** the blueprint's own words — a production-ready Payment Platform supporting multiple providers through the existing Integrations Registry, never tightly coupled to Razorpay. Reuses Module 6.1's Provider Registry/two-factor gate, Module 6.5's event bus/automation-trigger wiring, and the shared scheduler — no second config/health system, no second event-distribution layer, no second poller.

**Audited first.** Verified Module 6.3 (Calendar & Meeting Connectors) fully intact — `tsc`/full unit suite clean, no incomplete production-critical work — before starting 6.4. Confirmed `razorpay`/`stripe` were still bare catalog placeholders (`plannedModule: "6.4 — Payments"`, zero real code) and found the exact seam this module was meant to fill: `lib/services/marketing/types.ts`'s own `RevenueProvider` interface, whose doc comment has said "a seam for the future Payments module" since Module 8 (Marketing Dashboard) — `getRevenueProvider()` was hardcoded to `noRevenueDataProvider`, an honest "unavailable" placeholder every Analytics page load has shown since.

**Built, reusing the existing architecture rather than inventing a parallel path:**

- **A generic `PaymentProvider` interface** (`lib/services/payments/types.ts`) — `createCheckoutSession`/`getPaymentStatus`/`createRefund`/`verifyWebhookSignature`/`parseWebhookEvent` — with three real, fetch-based adapters (no SDK dependency, the established convention) and two disclosed scaffolds, matching the mission's own explicit "(future)" labels: **Razorpay** and **Cashfree** (India, both via each vendor's own real Payment Links API — a hosted, redirect-based checkout URL, no vendor JS SDK embedded on any page) and **Stripe** (international, via real Checkout Sessions). **PhonePe**/**PayPal** throw a disclosed `PaymentProviderNotImplementedError` on every method — the same posture WhatsApp's AiSensy/Interakt/WATI/Gallabox and Email's SendGrid/Resend scaffolds already established for a vendor this pass didn't implement, never a working-looking button that silently accepts real money.
- **Credentials stay env-only, the same shape AWS S3/Cloudinary already use** — a payment gateway's real credential is one API key pair for the whole deployment, not a per-connection secret an admin pastes, so `credentialRef` stays `{type:"env"}` and nothing is ever encrypted into the database. `config/payments.ts` holds `RAZORPAY_KEY_ID`/`_SECRET`/`_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`/`_WEBHOOK_SECRET`, `CASHFREE_APP_ID`/`_SECRET_KEY`/`_WEBHOOK_SECRET`. Every provider is independently connectable through the Integrations Registry (Calendar's own "no single active provider" shape, not Storage's) — a real deployment can run Razorpay/Cashfree for India and Stripe for international simultaneously. The existing generic `/connect` route needed zero changes — no new credential-paste UI, `IntegrationCard`'s existing empty-body Connect flow already works for an env-configured provider.
- **A new `Payment` collection** (the "Meeting"/"FileAsset" of this module) — one row per checkout attempt, `amountInSmallestUnit` uniformly across every provider (paise/cents, Stripe's own convention, applied consistently — Cashfree's own API uses major units, converted locally in its adapter so nothing above it ever has to know), named `leadId`/`registrationId`/`opportunityId`/`campaignId` fields (not just a generic relatedEntity pointer — a payment can relate to a Lead **and** a campaign **and** optionally a Registration/Opportunity simultaneously, which a single polymorphic pair can't represent). A new `PaymentWebhookEvent` collection logs every inbound webhook regardless of outcome (processed/duplicate/signature_invalid/unrecognized/error) — real idempotency via `providerEventId`, and the "Webhook Status" admin visibility Module 2.4 already established for WhatsApp's own inbound webhooks, applied here to payment providers.
- **Real HMAC-signed webhook verification per vendor's own documented scheme** — Razorpay (`X-Razorpay-Signature`, HMAC-SHA256 over the raw body), Stripe (`Stripe-Signature`'s real `t=/v1=` scheme over `${timestamp}.${rawBody}`, with a 5-minute tolerance window — real replay protection, not just format-checking), Cashfree (`x-webhook-signature`/`x-webhook-timestamp`, HMAC-SHA256 over `${timestamp}${rawBody}`, base64). `timingSafeEqual` throughout, the same floor every signature check in this app already holds.
- **Retry/dead-letter handling reuses the existing scheduler exactly — no second poller.** A `payments.reconcile` job (self-rescheduling every 15 minutes, the same shape Module 2.3's own template-sync job established) queries payments genuinely stuck "created" past 30 minutes and re-derives their real status from the provider's own API — real robustness against a missed or never-delivered webhook, not decorative. "Retry Payment" for a failed checkout creates a genuinely **new** Payment row (`retryOfPaymentId` linking the two) rather than resurrecting the dead one in place — a real payment gateway has no "retry this exact order" operation once an order is dead, so a retry is always a new order under the hood regardless of provider.
- **CRM Integration, real and direct, not just named:** a successful payment logs to the Lead's **and** Opportunity's Timeline (both, when both are linked — `activityService.logSystemEvent`, Module 4.1's own function); confirms a linked Registration from "pending" to "confirmed" via a new `registrationService.confirmRegistration()` (the repository's own `updateStatus()` method existed since Registration was first built but had never been called by any service method until now); publishes `payment.success`/`payment.failed`/`payment.refund` on the event bus — the exact reserved event names Module 6.5's own event picker catalogued in advance of this module existing. **`payment.success` is wired as a real Automation trigger** (`SUPPORTED_TRIGGER_EVENT_TYPES` in `triggers.ts`, alongside `lead.created`) — "successful payments should be available as Automation triggers," the mission's own words, satisfied by construction: any persisted WorkflowDefinition can now trigger off a real payment.
- **The `RevenueProvider` seam is filled in for real** — `payments.revenue.provider.ts` replaces the placeholder (now deleted; its own doc comment predicted exactly this replacement) with a genuine implementation reading the real `Payment` collection: `paidStudentCount` counts distinct leads with a succeeded payment in range, `totalRevenueInr` sums only INR-denominated succeeded payments (disclosed — a non-INR payment still counts toward `paidStudentCount`, but folding it into one INR total would mean fabricating an exchange rate this codebase's own "never fabricate a number you can't verify" discipline rules out). `dataAvailable` is now unconditionally `true` — a real, persisted source of truth exists, so an empty range reports a genuine `0`, not "unavailable."
- **Admin UI:** a new full `/admin/payments` page (Growth nav group, `manager`+ to view, `admin` to create/refund/retry — money-moving actions get the stricter tier) — Payment Analytics summary cards (reusing `StatCard`, the same component Dashboard/Analytics already use), a Create Payment form (real checkout-session creation, shows the real hosted checkout URL once), a filterable Transaction List (`Table`, the same shared component Registrations/Leads/Campaigns already use) with per-row Check Status/Refund/Retry actions gated by status and role, and a collapsible Webhook Status panel mirroring Module 6.5's own Webhook Deliveries panel. `providerCatalog.ts` updated: Razorpay/Stripe/Cashfree get real descriptions (no more `plannedModule`); PhonePe/PayPal added as disclosed future entries.

**QA:**

- Production build, `npx tsc --noEmit`, ESLint: all clean on every file this module touched (zero warnings or errors — the same two pre-existing, already-disclosed unrelated test-file `tsc` errors remain, untouched).
- 44 new unit tests: `validateCreateCheckoutSessionInput`/`validateCreatePaymentInput`'s full surface; all three real providers' signature verification (tested against hand-computed real HMAC signatures, not just each provider's own signing helper — a shared bug in both couldn't otherwise be caught) and webhook-payload parsing, plus the two scaffolds' disclosed-error behavior on every method; `paymentService`'s full lifecycle (create success/failure with real Error Recovery, checkStatus transitions + idempotency + Registration confirmation, refund full/partial, retry linkage and rejection of a non-failed payment, webhook processing — signature-invalid/duplicate/success/no-matching-payment — and reconciliation of a stale pending payment) against the in-memory repositories with mocked fetch; the real `RevenueProvider`'s own currency-filtering/distinct-lead-counting/date-range-scoping logic. Full existing unit suite re-run clean: 355/355 (up from 311), no regressions.
- **Live-verified in a real logged-in browser against the real MongoDB replica set and Razorpay's real live API, not just structurally.** Confirmed the not-connected gate degrades honestly (a safe generic 500, the same uncaught-throw posture Module 6.3's own not-connected gate already takes) before connecting anything. Connected Razorpay with well-formed but fake test keys via the existing generic Connect flow (zero new UI needed) — creating a checkout genuinely reached Razorpay's own real API (a real ~470ms round trip) and was correctly rejected, persisted as a real "failed" Payment row with a working Retry action; clicking Retry created a real second Payment (`retryOfPaymentId` correctly linked, a real second ~10.7s round trip, also correctly rejected) — both audited as `payment.created`/`payment.retried` with `entityType: "Payment"`, confirming the AuditLog schema enum accepts it. The inbound webhook receiver was hit over real HTTP via curl: a wrong signature returned a real 401; a correctly HMAC-signed payload (computed independently, not through this app's own signing code) returned 200 and was recorded with outcome `"error"` (no matching Payment for the synthetic order id) — both visible correctly in the Webhook Status panel. The full Settings → Integrations Provider Registry rendered all five payment providers correctly, including PhonePe/PayPal's real disclosed "not yet implemented" description text. No regressions on existing Leads/Registrations/Settings/Integrations UI.
- **Module 6.4 is complete against its own approved scope. Phase 6 (Integrations Hub) now has all five of its modules shipped — Registry, Storage, Calendar, Webhooks/Notifications, and Payments — the first Post-V1 phase (of 5, 6, 8) other than 5 to close out entirely.** Phases 0–5, 7, and 8 are unchanged by this pass.

---

## Generic Webhooks & Team Notifications — Module 6.5 (Post-V1, Phase 6 continues — four of five modules now shipped)

**Goal:** the blueprint's own words — a production-ready Event & Webhook Platform: every important business event should be able to trigger outbound webhooks, internal notifications, Slack, Microsoft Teams, Discord, or a future integration, and "future modules should be able to publish new events without modifying core architecture." Reuses Module 6.1's Integrations Registry for notification providers and the shared scheduler (Campaign Architecture) for retry, rather than building either a second config/health system or a second poller.

**Audited first.** The event bus (`lib/events/`) had exactly four real `publish()` call sites (`lead.created`, `message.received` ×2, `registration.created`) and only exact-string `subscribe()` — no wildcard, no way for a generic subscriber to see every event. Module 2.4's own `webhookDeliveries` collection audit note claimed it was "shared with Module 6.5's future generic webhook system" — direct inspection found that only half true: the loose `source: string` typing is reusable, but the collection is structurally inbound-only (no target URL, no HTTP status, no attempt/retry fields, no `update()` method) — reusing it honestly would need a real schema extension, not the "zero changes" the note implied.

**Built, reusing the existing architecture rather than inventing a parallel path:**

- **Event bus extended, not replaced.** `DomainEvent` gained `id` (`randomUUID()`), `version` (default `"1"`), and optional `metadata` — fully backward compatible, all four existing call sites untouched. Added wildcard (`"*"`) subscription support directly to `eventBus.ts`: `publish()` now dispatches to both type-specific *and* wildcard subscribers, so one generic fan-out subscriber (the new webhook dispatcher) sees every event without the bus needing a closed enum of valid types — the concrete mechanism behind "future modules publish new events without modifying core architecture." Registered via the bus's own self-bootstrapping `bootstrappers` array (the same Next.js module-graph-splitting fix `registerAutomationTriggers()` already established), not a second registration path.
- **13 new `publish()` call sites wired across services** — `lead.updated`/`lead.assigned`/`lead.converted` (Leads/Assignment/Registrations), `task.created`/`task.completed`/`task.overdue` (Tasks), `opportunity.stage_changed`/`opportunity.won`/`opportunity.lost` (Pipelines), `workflow.started`/`workflow.completed`/`workflow.failed` (Automation Engine), `whatsapp.message.sent`/`delivered`/`read`/`failed` (the WhatsApp status webhook) — up from 4 pre-existing. `payment.success`/`payment.failed`/`payment.refund` are catalogued in the Admin UI's own event picker as explicitly reserved, since nothing publishes them without Module 6.4 (Payments), which doesn't exist — never fabricated.
- **A new, separate `WebhookEndpoint` / `WebhookDeliveryAttempt` collection pair** for OUTBOUND webhook delivery — deliberately not reusing 2.4's own inbound-only collection (see audit above). One `WebhookDeliveryAttempt` row per real HTTP attempt, not per event, so a delivery that failed twice before succeeding shows all three real attempts distinctly in Delivery History, not one row silently overwritten. HMAC-SHA256 request signing (`X-LearnSynaptic-Signature`/`-Timestamp`/`-Event` headers, the same shape GitHub/Stripe's own outbound webhooks use), AES-256-GCM secret encryption at rest (the fourth independent copy of this codebase's own proven encryption shape — deliberately not extracted into a shared helper, matching the established "copy the proven pattern locally per module" convention), and a minimal, disclosed SSRF guard (blocks `localhost`/`127.*`/`0.0.0.0`/`169.254.*`/`::1` — "a real, disclosed floor rather than none," not exhaustive DNS-rebinding protection).
- **Retry/dead-letter/auto-disable reuses the existing scheduler exactly — no second poller built.** Retryable failures (5xx/429/network/timeout) get the scheduler's own linear backoff (`{maxAttempts:5, backoffMinutes:[1,5,15,60,240]}`, ~5.3 hours total); a non-retryable 4xx is marked `dead_letter` immediately, even on attempt 1. Ten consecutive FINAL-attempt failures (not retries of the same event) auto-flip an endpoint to `"auto_disabled"` — a real kill-switch matching 6.1–6.3's own Integrations Registry gate posture, not just a manual UI toggle. Event Replay re-sends the stored `payloadSnapshot` to the same endpoint as a fresh attempt, deliberately NOT re-publishing the original domain event through the whole bus (re-publishing `lead.created` would re-trigger automation/scoring/assignment a second time — never the intent of "retry a failed webhook").
- **A fifth `IntegrationCredentialRef` discriminant, `{type:"webhook_url", encryptedUrl}`.** Slack/Microsoft Teams/Discord's real "post to one channel" mechanism is a bare Incoming Webhook URL, not an OAuth grant — forcing it into 6.3's `"oauth"` shape would mean fabricating an `accessToken`/`expiresAt`/`scope` for a credential type with none of those concepts. A dedicated `/api/admin/integrations/[providerId]/webhook-url` route accepts the plaintext URL and encrypts it server-side before ever constructing a credentialRef — never trusting a client to hand over an already-encrypted-looking value, the same posture 6.3's own OAuth callback route established for a different credential shape. Real, vendor-documented payload formats per provider: Slack's `attachments` array, Microsoft Teams' classic `MessageCard`, Discord's `embeds` (color as a decimal integer, not hex — the one real format difference). Notification providers reuse 6.1's `IntegrationConnection` exactly (one row per provider, since an org has one Slack workspace); generic webhook endpoints are a genuinely new, separate model (many rows possible per org, each with its own URL/secret/event-subscription list) — not a fit for `IntegrationConnection`'s one-row-per-provider shape.
- **Admin UI:** a new "Webhook Endpoints" panel (register with a catalogued-event-type checklist plus a free-text field for future event types, health/delivery-history/replay/rotate-secret/enable-disable/edit/delete) and a third `IntegrationCard` connect-flow variant — a paste-the-webhook-URL form for Slack/Teams/Discord, alongside 6.1's generic JSON-config connect and 6.3's OAuth-redirect connect — plus a "Test Notification" action. Both webhook endpoint registration and rotation show the real signing secret exactly once, in plaintext, the same UX every real webhook-secret product (GitHub, Stripe) uses.

**Two real bugs found and fixed by this module's own testing, not shipped silently — one of them three modules old.**

1. `jobHandlers.ts`'s auto-disable branch set `status: shouldAutoDisable ? "auto_disabled" : undefined` on every failed delivery, relying on the update path silently dropping an `undefined` key before persisting. The in-memory repository's `Object.assign`-based `update()` does **not** do that — it was wiping a real endpoint's `"active"` status to `undefined` on every ordinary non-final failure. Caught by a new unit test asserting endpoint status after a retryable, non-threshold failure. Fixed by conditionally spreading the `status` key instead of relying on serialization.
2. Live-testing a real webhook-endpoint registration against the real MongoDB replica set surfaced `AuditLog validation failed: entityType 'WebhookEndpoint' is not a valid enum value`. Checking the Mongoose schema's own hand-maintained `entityType` enum against the `AuditEntityType` TS union revealed `Integration` (6.1), `File` (6.2), and `Meeting` (6.3) had **all** been silently missing too — every audit write for those entity types has been failing (caught, logged, non-blocking, per this app's own "audit failure never blocks the real operation" principle) in a real deployment since each of those modules shipped. Invisible to every unit test in this repo because the in-memory audit repository never validates `entityType` at all. Fixed by syncing the schema's enum to the full union and adding `auditLog.model.unit.test.ts`, a regression test that fails if the two ever drift apart again.

**QA:**

- Production build, `npx tsc --noEmit`, ESLint: all clean on every file this module touched (the same two pre-existing, already-disclosed `tsc` errors in unrelated test files remain, untouched).
- 81 new unit tests: `secretCrypto`/`signing`/`validation`'s full surface (encrypt/decrypt round-trip, tamper detection, SSRF hostname blocklist), the full `webhookService` lifecycle (register/list/update/enable-disable/delete/rotate/test/replay) against the in-memory repositories, the dispatcher's event-matching (subscribed/unsubscribed/wildcard/disabled-endpoint, notification-provider subscription filtering) exercised through the *real* event bus via real `publish()` calls, the job handler's retry/backoff/dead-letter/auto-disable branching (isolated via direct `enqueueJob()` calls with test-controlled retry policies, the same "isolate the mechanism, not the whole pipeline" judgment the scheduler's own test file established), all three notification providers' real vendor-documented payload shapes, the generic event-formatter's severity inference across real and hypothetical future event types, and the new `AuditLog` schema/TS-union sync regression guard. Full existing unit suite re-run clean: 309/309 (up from 228), no regressions.
- **Live-verified in a real logged-in browser against the real MongoDB replica set and real third-party HTTP endpoints, not just structurally.** Registered a real webhook endpoint against `httpbin.org/post`: one real delivery genuinely timed out (the AbortController's own 10s ceiling — a real network condition, not a bug), Replay produced two further real attempts (one landing a real `HTTP 503` from httpbin's own instability, correctly recorded as `dead_letter` with a fresh attempt number each time, all three attempts visible distinctly in Delivery History). A second endpoint against `postman-echo.com/post` delivered successfully end to end (green "delivered" badge, real signed headers, `HTTP 200`). Connected Slack with a well-formed but fake Incoming Webhook URL and clicked Test Notification: the request reached Slack's own real API, which rejected it with a real, specific `404: no_team` — proving the encrypt/decrypt/real-payload-build/real-HTTP/error-surfacing pipeline is genuinely wired end to end, not mocked at any layer. Existing Leads/Settings/Integrations Registry UI confirmed rendering correctly alongside the new panels — no visual regressions.
- **Module 6.5 is complete against its own approved scope. Phase 6 (Integrations Hub) now has four of its five modules shipped** — Registry, Storage, Calendar, and Webhooks/Notifications — with only 6.4 (Payments) remaining. Phases 0–5, 7, and 8 are unchanged by this pass.

---

## Calendar & Meeting Connectors — Module 6.3 (Post-V1, Phase 6 continues)

**Goal:** the blueprint's own words — a production-ready Calendar & Meeting integration platform, with reusable provider architecture for Google Calendar, Google Meet, Microsoft Outlook Calendar, Microsoft Teams, and Zoom, integrating meetings with Leads/Opportunities/Activities/Tasks/Counsellors/Timeline/Audit Logs. Reuses Module 6.1's Integrations Registry rather than building a second provider config/health system, the same discipline 6.2 already established.

**Audited first.** Grepped the whole repo for any existing calendar/meeting/OAuth code: found none — a genuinely blank slate. The only near-neighbors were Activity's own manual `"meeting"` type (a free-text timeline note, not a scheduled/synced meeting) and a Task-list UI calendar-grid widget (unrelated). No `googleapis`/Microsoft Graph SDK/OAuth library existed in `package.json`; this is the first OAuth-callback route in the entire codebase.

**Built, reusing the existing architecture rather than inventing a parallel path:**

- **A generic `CalendarProvider` interface** (`lib/services/calendar/types.ts`) — OAuth methods (`getAuthorizationUrl`/`exchangeCodeForTokens`/`refreshAccessToken`) plus event methods (`listCalendars`/`getAvailability`/`createEvent`/`updateEvent`/`cancelEvent`) — with five real adapters backed by three real OAuth apps: `google_calendar`/`google_meet` share one Google Cloud OAuth app (Meet links come from the Calendar API's own `conferenceData`, not a separate Meet API); `microsoft_outlook_calendar`/`microsoft_teams_meetings` share one Azure AD app registration (Teams links come from Graph's own `onlineMeeting` fields on a calendar event); `zoom` has its own OAuth app and REST API. Two new catalog entries added (`microsoft_outlook_calendar`, `microsoft_teams_meetings`) — the pre-existing `microsoft_teams` notifications entry (Module 6.5, a Slack-style webhook target) is untouched and distinct on purpose, documented directly in both catalog entries' own descriptions.
- **Real OAuth 2.0 request-building against each vendor's documented endpoints** — plain `fetch`, no SDK dependency, the same "hand-rolled fetch unless the crypto itself is genuinely complex" convention `awsS3.provider.ts` (6.2) already deviated from for the opposite reason (SigV4 signing). Zoom's own lack of a calendar/free-busy concept is disclosed rather than faked: `listCalendars()` returns one synthetic "My Zoom Meetings" entry, and `getAvailability()` derives real busy intervals from the account's own scheduled-meetings list (real data, honestly not a true calendar computation).
- **A fourth `IntegrationCredentialRef` discriminant, `"oauth"`** — the exact extension point that type's own doc comment named since 6.1 ("a future module only needs to add a new discriminant case"). Access/refresh tokens are never stored in plaintext: `lib/services/calendar/tokenCrypto.ts` AES-256-GCM-encrypts them at rest using a dedicated server secret (`CALENDAR_TOKEN_ENCRYPTION_SECRET`, distinct from `JWT_ACCESS_TOKEN_SECRET` — poor key hygiene to reuse a session-token secret for a different cryptographic purpose), so `IntegrationConnection.credentialRef` still holds no raw secret, the same invariant "env"/"vault" already upheld.
- **The OAuth `state` param is a real CSRF defense, not a placeholder** — `lib/services/calendar/oauthState.ts` signs `{providerId, nonce, expiresAt}` with HMAC-SHA256 (10-minute TTL), the identical proven pattern `signedUrl.ts` established for Module 6.2's local file delivery, applied to a different purpose.
- **The same two-factor Integrations Registry gate 6.2 established**, reused exactly: an OAuth app being configured in `config/calendar.ts` only makes the "Connect" button functional; `calendarService`'s own `assertProviderReady()` additionally requires the connection to show connected+enabled before a single vendor call is placed. Proactive token refresh (`getValidTokens()`) runs before every vendor call, refreshing and re-encrypting a token within 2 minutes of expiry — real Error Recovery, not just a documented intention. A new `integrationService.updateCredentialRef()` method (Module 6.1) supports this — updates only `credentialRef`, deliberately not audit-logged, the identical "routine/automated/high-frequency" threshold `recordSync()` already established.
- **A central `Meeting` model** (`lib/db/models/meeting.model.ts`, full dual-repo pair) — provider, externalEventId, title/description, start/end/timezone, meetingLink, status (scheduled/confirmed/cancelled/completed), invitees, reminderMinutesBefore, syncStatus (synced/pending/failed) + lastSyncError, `relatedEntityType`/`relatedEntityId` (deliberately a plain string, not a closed union — the identical deviation `FileAsset` already made for the identical reason). A failed provider call still persists the Meeting row (visible, retriable) rather than vanishing — real Error Recovery.
- **CRM Integration:** `calendarService.scheduleMeeting()` calls `activityService.logSystemEvent()` directly (Lead or Opportunity — Activity's own entity union already supports both) so a scheduled/cancelled meeting automatically appears in the Timeline, satisfying the module's own explicit requirement by construction. An optional `createFollowUpTask` flag reuses `taskService.createTask()` directly — no new automation logic, just an existing service called from a new place.
- **Reminder Support, real but minimal, matching the "extension point" framing** — `Meeting.reminderMinutesBefore` + `calendarService.processPendingReminders()` mirrors `taskService.processPendingReminders()`'s own precedent exactly (same fire-once-guard shape). `NotificationType`/`entityType` (Module 1's own notification system, previously Task-reminder-only by explicit design) gained a `"meeting_reminder"`/`"Meeting"` case — a small, real widening of the same "due-soon reminder for something a counsellor owns" shape, not a general-purpose notification system.
- **One new Automation action, `schedule_meeting`**, the only workflow-trigger extension point built — param-driven (`createTask.ts`'s own shape, not the no-params `analyze_*_ai` shape, since a meeting needs a title/duration/provider a trigger can't infer), resolving the invitee from `context.data.email` (the same convention `sendEmail.ts` already established). No new trigger types, no follow-up-automation logic beyond this one integration point, per the module's own explicit "do not implement new automation logic beyond the required integration" instruction. Added to `WorkflowStepBuilder.tsx`'s own UI (provider/title/duration/start-offset fields) so it's actually usable from the existing builder, not just the API.
- **Admin UI:** the existing `IntegrationCard` component (6.1) was taught about one more credential type — a calendar-category provider's "Connect" button navigates the whole browser to `/oauth/authorize` (real vendor consent screen) instead of POSTing empty JSON, plus a new "Sync Now" action (a real, cheap `listCalendars()` call that refreshes health via the registry's own `recordSync`). A new `CalendarOAuthBanner` (Suspense-wrapped `useSearchParams`, matching the login page's own established precedent) shows a success/error banner after the OAuth callback redirects back. No second Integrations panel built. A new "Meetings" section on the Lead Details page (mirroring 6.2's own Attachments section) provides real scheduling/list/cancel UI.
- **Safe error handling throughout:** the OAuth callback route never returns raw JSON mid-browser-flow — it always redirects back to Settings with a short, safe error code (`denied`/`invalid_request`/`connection_failed`), the real vendor error text never reaching a URL a browser history could retain. Explicitly mapped 404s for "provider not connected" on `/calendars`/`/availability`/`/calendar-sync`; the meetings-schedule route leaves its own "not connected" gate as an uncaught throw (a safe generic 500 via `handleApiError`), the identical posture 6.2's own upload route already takes for the same gate.

**QA:**

- Production build, `npx tsc --noEmit`, ESLint: all clean on every file this module touched (the same two pre-existing, already-disclosed `tsc` errors in Module 2.5's own test files remain, untouched).
- 31 new unit tests: `tokenCrypto`'s AES-GCM round-trip/tamper-detection, `oauthState`'s CSRF round-trip/tamper/expiry, `validateScheduleMeetingInput`'s full validation surface, and `calendarService`'s real "not configured" degradation, the two-factor gate, and — against a connected provider with mocked `fetch` — the full schedule/fail/cancel/list lifecycle plus the proactive-token-refresh path (correctly surfacing "not configured" in this env, since a real refresh grant needs client credentials per the OAuth spec — honest behavior, not a shortcut). Plus the `schedule_meeting` automation executor's own param validation and a real successful mocked-fetch run. Full existing unit suite re-run clean: 228/228 (up from 197), no regressions.
- 13 new Playwright specs run against a real production build over real HTTP: unauthenticated rejection; admin-vs-counsellor RBAC tiering across every new route; 400 on invalid meeting input; a safe generic 500 (no leaked stack trace) for an unconnected provider; explicit 404s for the calendars/availability/sync routes; OAuth authorize's real 400 when the vendor app isn't configured; the OAuth callback's safe-redirect-never-raw-JSON behavior for both a tampered state and a vendor denial; 404s on a nonexistent meeting id; relatedEntity list-scoping; and the Settings page rendering the five new provider cards. Full existing Playwright regression suite re-run clean: 78/78 (up from 65), no regressions — confirming existing CRM, WhatsApp, Automation, and AI modules all still work.
- **Live-verified in a real logged-in browser against the real MongoDB replica set:** clicking "Connect" on the Google Calendar card correctly navigated to the real OAuth-authorize route and surfaced the exact, honest "missing env vars: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI" message — real wiring, real degradation, no fabricated redirect. The Lead Details page's new Meetings section rendered correctly with the real lead's email in its own disclosure text, the Schedule form opened/closed correctly, and client-side validation correctly rejected an incomplete submission. Existing Leads list, Lead Details page, and Settings page all confirmed rendering correctly alongside the new UI — no visual regressions.
- **Organization isolation testing: disclosed, not fabricated.** Confirmed via direct research (grepping every repository's `list()`/`findById()` implementation) that `organizationId` remains schema-only and unenforced across the *entire* codebase — not a single collection filters by it. This module's own `Meeting.organizationId` field matches that same, consistent precedent rather than becoming the first mover on real tenant isolation (Module 6.1's own doc comment already states this explicitly for `IntegrationConnection`). The isolation that *is* real and tested: `relatedEntityType`/`relatedEntityId` list-scoping, the same mechanism 6.2's own Files list already relies on.
- **Module 6.3 is complete against its own approved scope.** Module 6.4 (Payments) explicitly not started, a separate future scope decision.

---

## File Storage — Module 6.2: Generic Storage Provider (Post-V1, Phase 6 continues)

**Goal:** the blueprint's own words — a centralized, provider-agnostic file storage system every module (WhatsApp media, Conversation attachments, CSV import, CRM attachments, org/avatar assets, future exports, future Student Portal/LMS) calls through the same seam, instead of each module inventing its own upload path. Reuses Module 6.1's Integrations Registry for provider config/health rather than building a second one.

**Audited first, reused what already worked:** grepped for base64/filesystem/Cloudinary/S3 usage, existing attachment models, and every WhatsApp-media/CSV-import code path before writing anything. Found zero existing storage abstraction — WhatsApp inbound media is proxied live through Meta's own temporary CDN URLs on every view (`metaCloudApi.provider.ts`, `conversations/media/[messageId]/route.ts` — its own doc comment already named this module as the future dependency), CSV import is a pure in-memory parse with no persistence at all, and no generic `File`/`Asset` model exists anywhere among the app's 30 models. Nothing to reuse at the storage layer itself; the Integrations Registry (config/health/kill-switch) was the one real reusable seam, and this module builds on it directly rather than duplicating it.

**Built, reusing the existing architecture rather than inventing a parallel path:**

- **A generic `StorageProvider` interface** (`lib/services/storage/types.ts`) — `upload`/`delete`/`exists`/`getPublicUrl`/`getSignedUrl` — with three real implementations: `local` (real filesystem, the safe zero-config dev default), `aws_s3` (official `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` — a deliberate, disclosed deviation from this codebase's usual fetch-only vendor-adapter convention, because hand-rolled SigV4 signing is genuine, high-risk-of-subtle-bugs cryptography unlike the simple bearer-token REST APIs that convention was built for), and `cloudinary` (plain `fetch` + Node's own `crypto` implementing Cloudinary's documented signed-upload scheme). `STORAGE_PROVIDER` selects the active adapter, the same env-driven registry shape as WhatsApp/Email/AI.
- **Two-factor gate for non-local providers, a real admin kill-switch.** `STORAGE_PROVIDER` picks which adapter's code runs, but AWS S3/Cloudinary additionally require an admin to have connected *and* enabled them via Settings → Integrations (Module 6.1, unmodified) before `fileStorageService` will route a single byte to them — `integrationService.getIntegration()`/`.recordSync()` reused directly, no second config/health system built. `local` skips the gate; it has no external account to connect.
- **A disclosed, deliberate gap: Cloudinary's private/authenticated-delivery URL signing is not implemented.** Upload/delete/exists/getPublicUrl are all real, working, signed calls against Cloudinary's documented API; `getSignedUrl()` throws a clear `StorageProviderError` for Cloudinary specifically, with a doc comment recommending AWS S3 or `local` for private files — the same "never fabricate a security-relevant mechanism you can't verify" call this codebase already made for `WhatsAppProviderNotImplementedError`/`EmailProviderNotImplementedError`.
- **A centralized `FileAsset` model** (`lib/db/models/fileAsset.model.ts`, full dual-repo pair) — provider, storageKey, filenames, MIME/extension/size, category, checksum, visibility, uploadedBy, `relatedEntityType`/`relatedEntityId` (deliberately a plain `string`, not a closed union like Activity's own `entityType` — File must stay reusable by modules that don't exist yet), soft-delete via `deletedAt`. 12 categories (IMAGE/VIDEO/AUDIO/DOCUMENT/CSV/AVATAR/ORGANIZATION_ASSET/WHATSAPP_MEDIA/EMAIL_ATTACHMENT/CRM_ATTACHMENT/EXPORT/OTHER) drive per-category size limits and MIME allowlists.
- **Real upload security, not just documented intent** (`lib/services/storage/validation.ts`): per-category size ceilings (WHATSAPP_MEDIA capped at 16MB, matching Meta's own real Cloud API limit), MIME/extension allowlisting, a hard dangerous-extension/MIME blocklist (`.exe`/`.sh`/`.php`/`.jar`/etc., checked both ways since either alone is client-spoofable), filename sanitization, and best-effort magic-byte content sniffing for the formats with a stable signature (PNG/JPEG/GIF/WebP/PDF) — disclosed as best-effort, not exhaustive, since most audio/video codecs have no simple signature to check. The actual path-traversal defense is structural: `storageKey` is always a fresh `randomUUID()`, **never** derived from the client-supplied filename, so sanitization is defense-in-depth, not the real control.
- **Private files get real signed URLs, not a public path by default.** For `local` (no real CDN to ask), the app signs its own: HMAC-SHA256 over `storageKey:expiresAt` (reusing `JWT_ACCESS_TOKEN_SECRET`, no second secret), verified by a deliberately unauthenticated route (`/api/files/local/[...key]`) — unauthenticated because a signed URL's entire point is time-limited access without a session, the same shape a real S3 presigned URL or Cloudinary delivery link already has.
- **WhatsApp compose media and Lead attachments wired through the same generic API**, not two bespoke upload paths. Conversations' compose panel uploads via `category: "WHATSAPP_MEDIA"` and warns explicitly if the active provider has no real public URL Meta can fetch (`local`'s own disclosed limitation) rather than silently sending a broken link. The Lead Details page gained a real Attachments section (`category: "CRM_ATTACHMENT"`, `relatedEntityType: "Lead"`) with upload/list/download/delete — existing WhatsApp send and webhook processing untouched.
- **CSV import deliberately left as-is.** It's already a pure in-memory parse with `MAX_ROWS=5000` and zero temp-file retention — there is no orphaned-upload problem to solve there, and forcing it through the new generic file API would add persistence this path never needed.
- **RBAC floor set at `"counsellor"`** on every generic file route (matches Leads/Activities precedent — a counsellor must be able to attach a file to their own lead); the route doesn't know what a "Lead" or "Conversation" is, so a stricter tier for a specific use case (e.g. WhatsApp compose) is enforced by *that* caller's own existing route, not duplicated here.
- **Audit logging:** `file.uploaded`/`file.deleted` on every manual upload/delete — no automation-triggered file-upload path exists yet in this codebase, so no manual/automation distinction was needed this pass.
- **Admin UI reused Module 6.1's existing `IntegrationCard` component as-is** for AWS S3/Cloudinary provider/health/config display — no second Storage-specific integrations panel built, honoring "do not create a second integration configuration system" by construction rather than by discipline.

**A real bug was found and fixed by the E2E suite, not shipped.** `GET /api/admin/files/[id]/download` called `NextResponse.redirect(url)` with the relative path `local`'s signed-URL scheme returns (`/api/files/local/...`) — Next.js requires an absolute URL for a redirect and was throwing a 500 on every local-provider download. Caught immediately by the new Playwright spec (not assumed passing); fixed by resolving the URL against the request's own origin (`new URL(url, request.url)`), which also passes through S3/Cloudinary's already-absolute URLs unchanged.

**QA:**

- Production build, `npx tsc --noEmit`, ESLint: all clean on every file this module touched (the same two pre-existing, already-disclosed `tsc` errors in Module 2.5's own test files remain, untouched).
- 34 new unit tests: `validateUpload()`/`sanitizeFilename()`/`generateStorageKey()`/magic-byte sniffing (oversized/empty/disallowed-MIME/dangerous-extension/dangerous-MIME/content-mismatch rejection, storageKey never leaking the original filename), the local signed-URL scheme's full round-trip (valid/wrong-key/tampered/expired/missing-params), and `fileStorageService`'s upload/list/get/delete/getDownloadUrl lifecycle against the real local provider (real bytes written to and read back from disk) plus the aws_s3 "not connected" and "connected but unconfigured" gate paths (via `vi.resetModules()` + a stubbed `STORAGE_PROVIDER`, the same technique already established for env-driven module-load-time constants). Full existing unit suite re-run clean: 197/197, no regressions.
- 8 new Playwright specs run against a real production build over real HTTP: unauthenticated rejection on every file route; a full counsellor upload → get → download-redirect → fetch-real-bytes-from-the-signed-URL → delete → confirm-404-and-bytes-gone lifecycle; oversized-file rejection; dangerous-extension rejection; magic-byte-mismatch rejection; 404s on a nonexistent id across get/download/delete; a tampered local-signed-URL rejection; and `relatedEntityType`/`relatedEntityId` list filtering (the Lead-attachments use case). Full existing Playwright regression suite re-run clean: 65/65, no regressions.
- **Live browser UI verification (WhatsApp compose media, Lead attachments panel) was attempted but not completed** — seeding a session into a running dev server's in-memory store from a separate process isn't possible (documented constraint, `tests/e2e/helpers.ts`), a real local MongoDB is configured in this environment but a standalone script/instrumentation-hook connection to it did not complete within a reasonable wait, and a same-process seed via a temporary `instrumentation.ts` hook hit a module-singleton boundary between Next's instrumentation graph and the API route graph (the seeded user wasn't visible to the route handler). This is disclosed as an unverified gap, not silently assumed — every code path those two UI surfaces call (upload/list/download/delete, RBAC, validation, signed URLs) is independently covered by the Playwright suite above over real HTTP against a real production server, which is what actually found and fixed the one real bug this module shipped with.
- **Module 6.2 is complete against its own approved scope.** Module 6.3 (Calendar & Meeting Connectors) explicitly not started, a separate future scope decision.

---

## Integrations Hub — Module 6.1: Generic Integrations Registry (Post-V1, Phase 6 opens)

**Goal:** the blueprint's own words — a central integration architecture so LearnSynaptic can support current and future external integrations (WhatsApp/Email/AI already built; Storage/Calendar/Payments/Notifications/Webhooks all still to come) **without tightly coupling the CRM to individual providers.** This is architecture, not integrations: Module 6.1 builds the registry and lifecycle-tracking shell; the real Storage/Calendar/Payments/Notifications/Webhook functionality is explicitly out of scope, left for 6.2–6.5.

**Built, reusing the existing architecture rather than inventing a parallel path:**

- **A static Provider Registry** (`lib/services/integrations/providerCatalog.ts`) — 15 providers across 6 categories (Communication: WhatsApp, Email; AI: OpenAI, Anthropic, Gemini; Storage: AWS S3, Cloudinary; Calendar: Google Calendar, Google Meet, Zoom; Payments: Razorpay, Stripe; Notifications: Slack, Microsoft Teams; Other: Generic Webhook), each with `id`/`name`/`category`/`capabilities`/`builtIn`/`plannedModule`. A future provider is a new array entry, never a new branch in a switch statement anywhere in the CRM — the "capability-based, not scattered logic" requirement satisfied by construction.
- **Two layers of status, merged into one view.** WhatsApp/Email/OpenAI/Anthropic/Gemini already have real, working provider-registry seams from Phases 2/4/5 (`config/whatsapp.ts`, `config/emailChannel.ts`, `config/aiInsights.ts`) — this module reads their *live* status read-only (`lib/services/integrations/builtInStatus.ts`) rather than tracking a second, competing source of truth for them. Every other provider gets the module's own full lifecycle: a new `IntegrationConnection` collection (status, enabled, config, credentialRef, health, lastSuccessAt/lastFailureAt/lastError) plus a new append-only `IntegrationLog` collection (connect/disconnect/enable/disable/config_updated/sync/health_check events) — the same "one row per event, never updated" shape `WebhookDelivery` (Module 2.4) already established.
- **Credential references, never credentials.** `IntegrationConnection.credentialRef` is a discriminated union (`{type:"env", description}` | `{type:"vault", ref}` | `{type:"none"}`) — never the secret value itself. `config` (genuinely generic per provider category) is validated server-side to reject any key name that looks credential-shaped (`apiKey`, `secret`, `token`, `password`, `credential`) — live-verified with a real rejected request (`{config:{apiSecret:"..."}}` → 400, confirmed the value never reached Mongo, the API response, or any server log line). Real per-tenant secret storage is explicitly deferred — `credentialRef.type: "vault"` is the extension point a later module fills in, not built here.
- **Connect is deliberately rejected for builtIn providers**, with a clear error ("WhatsApp is configured via environment variables, not this registry") rather than a silent no-op or a second, competing connect path — the module's own "avoid duplicate connection logic" requirement enforced at the service layer, not just by convention.
- **Organization scaffolding matches existing precedent exactly, not ahead of it.** `IntegrationConnection.organizationId`/`IntegrationLog.organizationId` are optional fields, left unpopulated — the same state every other `organizationId` field in this codebase is already in (confirmed: `ensureDefaultOrganization()` has no caller anywhere yet). Module 6.1 isn't the first mover on real tenant scoping; that's Phase 8's job.
- **Audit logging, same threshold as every other AI CRM module's manual actions:** connect/disconnect/enable/disable/config-update each write a `integration.*` business-audit entry; `recordSync()` (the extension point a future 6.2+ module calls after a real sync attempt) does not — routine/automated, the same "high-frequency, no deliberate human action" exclusion already applied to Activity logging and 5.1/5.3's automation-triggered analysis runs.
- **Admin UI extends the existing Settings → Integrations section** (previously just the Module 2.4 Webhook Deliveries panel) with a new "Provider Registry" card: category filter, one card per provider showing status/enabled/health badges, last success/failure, Connect/Disconnect/Reconnect/Enable/Disable/Configure actions (a generic JSON config editor — no per-provider dynamic forms, matching "avoid provider-specific logic scattered across the CRM"), and an expandable Logs list. BuiltIn providers render read-only with a "Managed via environment configuration" note instead of action buttons.

**A real regression was found and fixed before this pass finished, not shipped.** The new panel's own `<h2>Provider Registry</h2>` heading was originally titled "Integrations Registry" — its substring collided with an existing Module 2.4 Playwright test's own `getByRole("heading", {name: "Integrations"})` lookup (no `exact: true`), which started matching two headings instead of one and failing. Caught by the full regression suite, not assumed passing — renamed the new card's title to "Provider Registry" rather than touching the pre-existing, already-correct 2.4 test.

**QA:**

- Production build, `npx tsc --noEmit`, ESLint: all clean on every file this module touched (the same two pre-existing `tsc` errors in Module 2.5's own test files remain, untouched).
- 39 new unit tests: config/credentialRef validation (rejecting every credential-shaped key name, accepting safe config, validating each `credentialRef` discriminant), the static catalog's own invariants (no duplicate ids, every provider has a capability, exactly the five expected builtIn providers), and the full service lifecycle (connect/reconnect/disconnect/enable/disable/config-update/sync-recording, builtIn rejection, not-found/not-connected error paths, log ordering).
- 6 new Playwright specs: RBAC (403 for a manager on list and connect), the Settings UI rendering the registry with real provider cards, a full connect → configure → disable → enable → disconnect → reconnect lifecycle over real HTTP, builtIn-provider rejection, credential-shaped-config rejection, and 404 for an unknown provider id.
- **Full regression suite run twice** (once before, once after the heading-collision fix) — confirmed the one real regression above, fixed it, and reconfirmed clean: same two pre-existing, already-disclosed failures (CRM Settings flake, pre-existing uncommitted `app/contact` work-in-progress) as every prior pass, nothing new.
- **Live-verified against the real MongoDB replica set, not just structurally.** Connected a real provider (Razorpay) with real config, confirmed the response never round-trips anything from a rejected credential-shaped key, confirmed via `grep` that the rejected secret value never appears in server logs, disconnected and reconnected it, and confirmed the exact real log history (with real timestamps) renders correctly in a real logged-in browser session — including the category filter and the Logs expand/collapse. Confirmed WhatsApp/Email/OpenAI/Anthropic/Gemini all correctly render "disconnected"/"unknown" (this environment's real, honest state — no vendor configured) with no Connect/Disconnect buttons, and confirmed the pre-existing CRM Configuration and Environment Configuration sections on the same page still render exactly as before.
- **Module 6.1 is complete against its own approved scope.** Phase 6 (Integrations Hub) is now open, with this its first module — 6.2 (File Storage) explicitly not started, a separate future scope decision.

---

## AI CRM — Module 5.3: Conversational Analytics (Post-V1, Phase 5 continues)

**Goal:** the blueprint's own words — analyze a whole Conversation and surface actionable insights a counsellor can act on: sentiment, intent, buying readiness, objections, a summary, and suggested next steps — read-only analysis that never touches the conversation it reads.

**A dependency note this audit carried since 5.1 was resolved this pass, not worked around.** Every prior pass (5.1, 5.2) disclosed 5.3 as blocked on 7.2 (Automation & Revenue Analytics) and 7.3 (Executive Dashboard), neither built. On inspection, that dependency was about aggregate revenue/executive reporting — nothing this module's own feature list (sentiment, intent, engagement, buying readiness, objections, summary, topics, missed opportunities, suggested actions, response quality, historical analytics per lead, trend analysis) actually needs 7.2/7.3's own code to exist for. Built directly, reusing 7.1's own "Analytics services" *pattern* (derive numbers from already-persisted data, no new AI call for the aggregation itself) rather than its code — the real prerequisite was a design lesson from Phase 7, not a runtime dependency on modules that don't exist.

**Built, reusing the existing architecture rather than inventing a parallel path:**

- **`lib/services/conversations/insights/` — a new `ConversationInsight` collection**, the same shape as 5.1's `LeadInsight` for the same reason: "Analysis History" is one of this module's own named requirements, and a counsellor should see *that* an analysis was attempted and why it didn't produce insights, not silently see nothing. `status`: `"ok"` | `"unavailable"` | `"error"`. **"Store AI analysis separately so conversations remain immutable"** is true by construction — nothing here ever writes to `Conversation` or `Message`.
- **`conversationInsightService.analyzeConversation()`** reuses `conversationService.getThread()` (4.1's function, the same building block 5.2's `aiReplyService` already reused) for message/note history, plus the linked Lead and its Opportunities (via 5.1's own `leadId` filters) for context. Asks the configured AI vendor (5.1's `lib/services/ai/` abstraction, unchanged) for sentiment, intent, an engagement score, a buying-readiness score, positive/negative signals, specific objections, a chronological summary, key topics, missed opportunities, suggested actions, and response-quality notes, all in one structured JSON response — one vendor call per analysis, not one per feature.
- **"AI-generated conversation timeline summary" and "conversation summary" are the same field, not two artifacts.** A timeline summary *is* a conversation summary framed chronologically; the system prompt asks for a chronological narrative and the schema has one `summary` field. Disclosed as a deliberate design call, not an oversight.
- **"Historical analytics for each lead" and "trend analysis across conversations"** are served by `conversationInsightService.getLeadHistory(leadId)` — every `ConversationInsight` ever recorded across every conversation a lead has had, newest first. A read-only aggregation over already-persisted insights, not a new AI call — the actual "reuse Analytics services" integration point, mirroring 7.1's own `pipelineAnalyticsService` shape (derive numbers from existing data).
- **Reused Workflow Automation, with a real architectural constraint surfaced and worked around, not ignored.** The WorkflowRun engine only ever runs against `Lead` entities (`triggers.ts` hardcodes `"Lead"` — no Conversation-scoped trigger exists). The new no-params `analyze_conversation_ai` action resolves the lead's own most-recently-active conversation (via the same `leadId` filter) and analyzes that one; a lead with no conversation yet no-ops rather than throwing, the same "don't fail a healthy WorkflowRun over a step with legitimately nothing to do" posture `analyze_lead_ai` already established.
- **Audit logging, same threshold as 5.1's `lead.ai_insight_analyzed`:** only a manual "Analyze Again" click writes `conversation.ai_analyzed`; an automation-triggered run does not (no state change worth a business-audit entry beyond the row itself, and far higher potential frequency than 5.1's own analysis runs).
- **Admin UI:** a new "AI Conversation Insights" panel on the Conversations thread view — sentiment badge, intent badge, buying readiness (+ engagement) chips, a chronological summary, Key Topics chips, a merged Risks list (objections + negative signals), Suggested Actions, Missed Opportunities, response-quality notes, and an Analyze Again/Analyze Now button. A collapsible Analysis History list shows past runs (timestamp, status, sentiment) — **found and fixed a real bug while live-verifying:** the history list was originally nested inside the "latest insight is ok" render branch, so it silently disappeared the moment the *most recent* run was "unavailable" or "error," even though older, successful runs existed in the history. Moved outside that branch so the toggle and its list always work regardless of the latest run's own status.

**QA:**

- Production build, `npx tsc --noEmit`, ESLint: all clean on every file this module touched (the same two pre-existing `tsc` errors in Module 2.5's own test files remain, untouched).
- 14 new unit tests: `parseConversationAnalysis()`'s response-normalizing logic (valid/fenced/out-of-range/unrecognized-enum/truncated-actions/malformed synthetic model output), `conversationInsightService.analyzeConversation()`'s graceful degradation and history ordering, and the `analyze_conversation_ai` executor's entity-type guard, no-conversation no-op, and graceful degradation.
- 3 new Playwright specs covering what's reachable without a seeded Conversation in this shared test environment (same disclosed constraint 5.2's own AI-reply spec already states): RBAC (403 for a manager on both GET/POST), 404 analyzing a nonexistent conversation, and a 200-with-empty-list for GET against a nonexistent conversation (a deliberate, disclosed asymmetry — listing is harmless without an existence check; analyzing genuinely can't proceed without a real conversation to read).
- **Live-verified against the real MongoDB replica set and a real vendor, independently of 5.1/5.2's own verification.** Seeded a real Lead and Conversation with a real multi-turn exchange through the actual service layer, then in a real logged-in browser session: Analyze Now with no AI vendor configured correctly rendered "AI analysis is unavailable"; with a real, intentionally invalid `ANTHROPIC_API_KEY`, Analyze Again correctly surfaced Anthropic's own real `401: invalid x-api-key` rejection in the UI — this module's own prompt/parsing code confirmed against a real vendor response, not assumed from 5.1/5.2. This same session is what surfaced and confirmed the fix for the Analysis History rendering bug above (two runs — one "unavailable," one "error" — needed to exist before the bug was visible at all).
- **Module 5.3 is complete against its own approved scope.** No real API key exists in this environment to verify a real *successful* analysis renders correctly end-to-end — the synthetic-JSON unit tests cover the parsing logic, and the UI's success-state code path is the same conditional-render pattern already exercised for the unavailable/error/history states, but a real round-trip is disclosed as unverified, not silently assumed. **Phase 5 (AI CRM) now has all three of its modules at spec — 5.1, 5.2, and 5.3 — the first Post-V1 phase to close out entirely.**

---

## AI CRM — Module 5.2: AI-Assisted Replies (Post-V1, Phase 5 continues)

**Goal:** the blueprint's own words — give a counsellor a one-click, AI-drafted reply suggestion inside a Conversation thread, in whichever tone fits, with a visible confidence level and an explanation, that they can insert, edit, and send — or discard entirely. The module's own line is absolute and shaped everything below: **AI should only suggest replies. Never send messages automatically.**

**Built, reusing the existing architecture rather than inventing a parallel path:**

- **Deliberately stateless — no new database model.** Unlike 5.1's `LeadInsight` (which needed a persisted history because "insights history" was its own explicit requirement), nothing here writes anything until a counsellor reviews, optionally edits, and sends a suggestion through the *existing* composer — at which point it's an ordinary outbound `Message`, indistinguishable from one typed from scratch. A discarded or regenerated suggestion leaves no trace, correctly: it was never sent or seen by the contact.
- **Reused 5.1's AI vendor abstraction (`lib/services/ai/`) directly** — the exact same `getAiProvider()`/`isAiProviderConfigured()` calls, no second vendor layer. Extracted the one piece of real duplication risk into a shared helper: `stripJsonFence()` (`lib/services/ai/parsing.ts`), now used by both 5.1's Lead Insights parser and this module's own — a model wrapping its JSON in a ```` ```json ```` fence despite instructions not to is a shared cosmetic-deviation problem, not a 5.1-specific one.
- **`lib/services/conversations/aiReply/aiReplyService.generateReply()`** gathers context via `conversationService.getThread()` (the exact function 4.1's Unified Inbox already built — messages + activities together for one conversation), plus the linked Lead (via `conversation.leadId`) and its Opportunities (via the `leadId` filter 5.1 already added to `OpportunityListFilters`) — no new repository methods needed. Builds a tone-specific prompt (Professional / Friendly / Concise / Follow-up, each with its own instruction line) and asks the model for `replyText`, `confidence`, `reasoning`, `suggestedFollowUps`, and a best-effort `detectedLanguage` (the system prompt explicitly asks the model to reply in whichever language/style the contact has been using — English, Hindi, or a mix are all common for this audience). Never trusts the model to send anything — the return value is a plain suggestion object, nothing more.
- **Deliberately NOT built on 3.1's WorkflowDefinition engine or 3.3's `AutoReplyRule` catalog** — the same call 3.3 itself made about 3.1, applied a second time: both of those exist to send *without* a human in the loop (a scheduled workflow step, a keyword-matched auto-reply); this feature's entire point is a human reviewing, editing, and only then sending. The only thing actually shared with either is the send primitive itself — accepting a suggestion still calls `conversationService.sendReply()`, the exact function the manual composer and 3.3's auto-replies already use, so this module adds no second send path.
- **Deliberately NOT audit-logged.** Unlike 5.1's manual "Analyze Again" (which writes `lead.ai_insight_analyzed`), generating or regenerating a suggestion changes no persisted state at all — nothing happens until a counsellor sends the resulting message, and that send is already covered by whatever audit posture `sendReply()` itself has. Logging every generate/regenerate click would also be far higher-frequency than 5.1's analysis runs (a counsellor might regenerate several times per reply), the same "high-frequency, no state change" threshold that already excludes plain Activity logging from the business audit log.
- **Admin UI:** a new "AI Reply Assistant" card inside the existing reply composer (`app/admin/(dashboard)/conversations/page.tsx`) — a tone selector, Generate Reply/Regenerate button, confidence chip, the model's own reasoning, and suggested follow-up questions (each individually insertable, same one-click principle as the main suggestion). "Insert into composer" hands the text straight to the composer's own existing text-mode state — the counsellor still reviews/edits and clicks the same Send button either way. Renders three distinct outcomes before ever showing a real suggestion (idle / unavailable / error), the same three-state discipline 5.1's AI Insights card established — never a blank or crashed section.

**QA:**

- Production build, `npx tsc --noEmit`, ESLint: all clean on every file this module touched. (Along the way, fixed a latent type error in 5.1's own `analyzeLeadAi.unit.test.ts` — three `WorkflowContext` literals were missing the required `data: {}` field, caught only by a fresh full `tsc` run since vitest doesn't type-check test files at run time. Two pre-existing `tsc` errors in Module 2.5's own test files, and the same two pre-existing/unrelated Playwright failures already disclosed for 5.1 — the CRM Settings flake and the pre-existing uncommitted `app/contact`/`ContactForm.tsx` work-in-progress — remain untouched by this pass.)
- 9 new unit tests: `parseReplySuggestion()`'s response-normalizing logic (valid/fenced/out-of-range/truncated-follow-ups/missing-language/malformed synthetic model output) and `aiReplyService.generateReply()`'s graceful degradation (unavailable when unconfigured, `null` for a nonexistent conversation).
- 3 new Playwright specs covering what's reachable without a seeded Conversation in this shared test environment (same disclosed constraint `conversations.spec.ts` already states — a real Conversation only comes into existence through a real vendor webhook): RBAC (403 for a manager), 404 for a nonexistent conversation id, 400 for an unrecognized tone.
- **Live-verified against the real MongoDB replica set and a real vendor, not just structurally.** Seeded a real Lead and Conversation via the actual service layer (`leadService.registerLead` + `conversationService.getOrCreateForContact` + a real inbound message — which correctly triggered 3.3's own real Auto-Reply Engine along the way, a nice confirmation that pipeline is still healthy), then in a real logged-in browser session: clicked Generate Reply with no AI vendor configured and saw the real "AI replies are unavailable" message render correctly; then, with a real (intentionally invalid) `ANTHROPIC_API_KEY`, clicked Generate Reply again and saw the real Anthropic `401: invalid x-api-key` rejection surfaced in the UI exactly as returned — the same "real vendor, real rejection, correctly handled" verification posture 5.1 and 2.3 both used, confirmed independently for this module's own prompt/parsing code, not assumed to carry over from 5.1.
- **Module 5.2 is complete against its own approved scope.** No real API key exists in this environment to verify a real *successful* suggestion (confidence badge, reasoning, follow-ups, Insert into composer) renders correctly end-to-end — the synthetic-JSON unit tests cover the parsing logic, and the UI code path for the success state is the same straightforward conditional-render pattern already exercised for the unavailable/error states, but a real successful round-trip is disclosed as unverified, not silently assumed. Phase 5 (AI CRM): 5.1 and 5.2 both at spec; 5.3 (Conversational Analytics) remains blocked on 7.2/7.3, not yet built.

---

## AI CRM — Module 5.1: AI Lead Scoring & Insights (Post-V1, Phase 5 opened)

**Goal:** the blueprint's own words for Phase 5 — give a counsellor an
AI-generated read on a lead (score, buying intent, strengths/risks,
suggested next action) alongside the existing rules-based score, without
ever fabricating an insight when no AI vendor is actually configured.
The product owner's own explicit direction opened Phase 5 with this
module; a real product/investment decision (which AI vendor, if any)
still belongs to whoever configures `AI_PROVIDER` in a given deployment
— this module makes that choice safe to leave unset.

**Built, reusing the existing architecture rather than inventing a
parallel path:**

- **Reused the `ScoringProvider` extension point Phase 1 built for
  exactly this** (`lib/services/crm/scoring/types.ts`'s own doc comment
  named "AI Lead Scoring, a later phase" as the seam's intended second
  implementation). Added `aiScoringProvider` (`id: "ai"`) alongside the
  existing `rulesBasedScoringProvider`, registered in the same
  `registry.ts` — no new scoring path, no change to how
  `leadService.recomputeAndPersistScore()` (the every-write hot path)
  calls `rules-based` by default. `ScoringProvider.score()` became
  `async` (the `ai` provider awaits a real vendor call); `rules-based`
  is unaffected, just wrapped in a resolved Promise. `LeadScoreResult`
  gained an optional `insight` field (summary, buying intent,
  strengths, risks, next action, confidence, reasoning, provider id) —
  only ever populated by the `ai` provider.
- **New vendor abstraction beneath it** (`lib/services/ai/`), the same
  two-layer split WhatsApp (service → provider → vendor adapters) and
  Email already established. Three real, fetch-based adapters —
  OpenAI, Anthropic, Gemini, no SDK dependency — selected via
  `AI_PROVIDER`. Unlike Email's SendGrid/Resend scaffolds (which always
  throw), all three here are genuine working integrations; the
  "scaffold" posture doesn't apply because there's no single
  vendor-of-record to prefer. `isAiProviderConfigured()` checks both
  `AI_PROVIDER` and the matching vendor's own API key are set — the one
  call site `aiScoringProvider.score()` needs to decide "fail
  gracefully" up front, before spending a request building a prompt.
- **Lead Insights history** (`lib/services/crm/leadInsights/`) — a new
  `LeadInsight` collection, one row per analysis run, deliberately kept
  even when a run couldn't produce a real result. `status` is
  `"ok"` | `"unavailable"` (no provider configured) | `"error"` (vendor
  call/response failed) — the module's own "insights history"
  requirement means seeing *that* an analysis was attempted and why it
  didn't work, not silent nothing. Never confused with the pre-existing
  `Lead.score`/`Lead.health` (the rules-based score, recomputed on every
  write) — this is additive, on-demand history.
- **`leadInsightService.analyzeLead()`** is the one place that gathers
  context — recent Activities, the lead's Conversation's recent
  Messages, its Opportunities — and runs it through
  `scoringService.computeScore(lead, "ai", richContext)`. Deliberately
  NOT wired into the always-on `recomputeAndPersistScore` hot path:
  fetching Activities/Messages/Opportunities on every lead save would
  add real DB load and vendor cost to a path that runs on every
  create/update. Two small additive filters were needed to gather that
  context at all: `ConversationListFilters.leadId` and
  `OpportunityListFilters.leadId` — neither existed before, both
  one-line additions to existing `list()` implementations, same shape
  as 2.5's own `archived` filter addition.
- **Manual re-analysis + automatic trigger:** "Analyze Again" on the
  Lead Details page calls `POST /api/admin/leads/[id]/insights`
  (`trigger: "manual"`, audited via a new `lead.ai_insight_analyzed`
  business-audit action — deliberately only for the manual path, the
  same "a person-initiated action clears the audit bar, a routine one
  doesn't" threshold Activity logging already established). A new
  `analyze_lead_ai` Automation Platform action (no params) calls the
  exact same `leadInsightService.analyzeLead()` with
  `trigger: "automation"` — an admin can add "Analyze Lead with AI" to
  any workflow (e.g. the lead nurture sequence) for hands-off analysis.
  Neither path throws when AI is unavailable: `analyzeLead()` catches
  `AiProviderNotConfiguredError` internally and persists an
  `"unavailable"` row instead, so a workflow step degrades exactly like
  the UI does — it never fails a whole automation run over a missing
  API key.
- **Admin UI:** a new "AI Insights" card on the Lead Details page
  (`app/admin/(dashboard)/leads/[id]/page.tsx`) — AI score, priority
  badge (banded from the same score, never the model's own subjective
  label — see `bandHealth()`, shared with `rules-based` so health is
  always a consistent read of a score, never a second value that can
  drift), buying intent, strengths/risks, suggested next action,
  confidence, last-analysis timestamp + vendor, and an Analyze
  Again/Analyze Now button. Renders three distinct states (no analysis
  yet / unavailable / error) before ever showing a real result — never
  a blank or crashed section.

**Design calls made explicit, not silently absorbed:**

- **The model's own health/priority label is never trusted directly** —
  `parseLeadInsightResponse()` asks for a numeric score and bands it
  through the same `bandHealth()` function `rules-based` uses, so an
  AI-generated "hot" always means "score ≥ 65," identical to the
  rules-based meaning, never a second inconsistent definition of "hot."
- **A malformed vendor response is a disclosed parse error, not a
  guessed default.** `parseLeadInsightResponse()` clamps score/confidence
  into 0-100, defaults an unrecognized `buyingIntent` to `"unknown"`,
  but throws `AiResponseParseError` outright if `score` or `summary` is
  missing — persisted as a `status: "error"` row with the real parse
  failure message, never a fabricated 0-score insight.

**QA:**

- Production build, `npx tsc --noEmit`, ESLint: all clean on every file
  this module touched. (Two pre-existing `tsc` errors in Module 2.5's
  own test files, and two pre-existing/unrelated Playwright failures —
  one already-disclosed CRM Settings flake, one caused by pre-existing
  uncommitted `app/contact`/`ContactForm.tsx` work-in-progress that
  predates this module — are untouched by this pass; see the audit's
  own Regression Risk section.)
- 18 new unit tests: `parseLeadInsightResponse()`'s response-normalizing
  logic (valid/fenced/out-of-range/malformed synthetic model output,
  the same "test the normalizer directly" approach 2.3's Graph API
  parsing already used, since this environment has no real vendor key
  to round-trip a real response through), `aiScoringProvider`'s
  graceful-unconfigured throw, `rulesBasedScoringProvider`'s
  unaffected-by-the-async-signature-change regression check,
  `leadInsightService.analyzeLead()`'s graceful degradation + history
  ordering, and the `analyze_lead_ai` executor's entity-type guard and
  graceful degradation.
- 2 new Playwright specs: the Lead Details page's full "no analysis
  yet" → "Analyze Now" → "unavailable" flow, and RBAC (a counsellor not
  assigned to the lead gets 403 on both GET and POST insights routes).
- **Live-verified against the real MongoDB replica set and a real
  vendor, not just structurally.** Created a real lead via the public
  API, called the real insights routes end-to-end against real Mongo
  (empty history → POST → persisted `"unavailable"` row → visible on a
  second GET). Then, with a real (intentionally invalid) `ANTHROPIC_API_KEY`
  and `AI_PROVIDER=anthropic`, called analyze again — Anthropic's real
  API rejected it with a genuine `401: invalid x-api-key`, correctly
  captured as a `status: "error"` row with that exact message,
  confirming the request shape and error-handling path are correct
  against the real vendor, not just a mock — the same verification
  posture 2.3 used for Meta's Graph API. Confirmed a third time in a
  real logged-in browser session: the AI Insights card rendered the
  real error message, then rendered the real "unavailable" message
  after "Analyze Again" once the server was restarted without an AI
  vendor configured — all three UI states (none/error/unavailable)
  confirmed visually, never just asserted in a test.
- **Module 5.1 is complete against its own approved scope. Phase 5 (AI
  CRM) is now open**, with this its first module — 5.2/5.3 (per the
  blueprint, if any) remain unbuilt, a separate future scope decision.

---

## WhatsApp Platform — Module 2.5: Campaign Enhancements (Post-V1, Phase 2 complete)

**Goal:** the blueprint's own words — "a marketer runs the same reminder
campaign every cohort without rebuilding it, and can prove which
campaigns actually convert." The last remaining module in Phase 2 —
completing it closes Phase 2 (WhatsApp Platform) out entirely, all five
modules (2.1–2.5) at spec.

**Built:** recurring campaigns, archive/duplicate, and click/reply-rate
tracking — everything the blueprint specifies except Campaign ROI,
which explicitly needs 6.4 (Payments, Post-V1, doesn't exist) and is
disclosed as out of reach, the same posture 2.2 already took toward its
own 6.2 dependency.

- **Recurring campaigns:** a new `WhatsAppCampaign.recurrenceRule`
  (`{frequency, interval}`) is optional at creation. `checkCampaignCompletion()`
  — the existing function that flips a campaign to "completed" once
  every Message resolves — now also auto-creates the next occurrence as
  a fresh draft when a recurrence rule is present. Deliberately **not**
  a fully unattended re-send: no audience-resolution "recipe" is
  persisted anywhere in this architecture (`audienceSource` is just a
  tag, never the actual `LeadListFilters`/recipient list a human
  supplied), so auto-resolving and auto-sending an audience nobody
  reviewed would be the wrong kind of automation for a real WhatsApp
  send. A marketer still resolves the new draft's audience and sends
  it — what recurrence saves is re-typing the name/template and
  remembering the cadence, disclosed directly in code comments, not
  quietly overstated as full automation.
- **Archive / Duplicate:** `archived` is a pure visibility toggle (Lead's
  own precedent), excluded from the default Campaign History list
  unless explicitly requested. `cloneCampaign()` creates a brand-new
  draft from only the reusable parts (name, template, marketing
  attribution, recurrence rule) — it never calls anything that creates
  a Message row, the same fresh-start shape `createCampaign` itself
  already produces. This is what makes the module's own Definition of
  Done true **by construction**: "cloning a completed campaign produces
  a clean draft with zero carried-over Message rows" isn't a guard this
  method has to separately enforce, it's the only possible outcome of
  how it's built.
- **Reply/click-rate tracking:** `replyCount`/`clickCount` on
  `WhatsAppCampaign`, incremented from inside
  `conversationService.recordInboundMessage()` — the single funnel every
  inbound WhatsApp message already passes through (Module 2.1). A new
  `findLatestOutboundCampaignMessage()` repository method finds the most
  recent outbound Message with a `campaignId` sent to the replying
  phone number; a `button_reply`/`list_reply` messageType additionally
  counts as a "click" — the closest real signal WhatsApp exposes to a
  button/list tap without Meta's own separate URL-click analytics API,
  which this app has no integration with. Silent no-op for the common
  case (most inbound messages are not a reply to a campaign at all).

**QA:** `npx tsc --noEmit`, `eslint`, and `npm run build` all clean.
**18 new unit tests** across two files — one exercising the module's own
stated Definition of Done directly (resolves a real audience, marks a
campaign completed with real non-zero rollups, clones it, and asserts
the clone is a draft with zero recipients/messages/counters — the exact
wording, not an approximation), the recurrence auto-clone (and that a
non-recurring campaign does *not* auto-create anything), the archive/
unarchive round-trip, and the reply/click attribution hook (plain text
vs. button/list reply, multiple campaigns to the same contact
attributing to the most recent, and the silent-no-op case). **4 new
Playwright specs** cover the full UI flow with no live-verification
substitute needed — unlike 2.3/2.4, none of this module's behavior
requires a real vendor account to exercise: creating a recurring
campaign end-to-end through the real form, cloning a campaign with a
real resolved audience and confirming the clone renders as a clean
draft in a real browser, archiving/unarchiving through the real list
page, and RBAC on the two new routes. Full suite: **83 unit tests + 43
Playwright specs, all passing** (one unrelated flake on the first
Playwright run, the same already-disclosed `crm-settings.spec.ts` flake
noted elsewhere in this file, confirmed clean on rerun). **Module 2.5 is
complete against its own approved Definition of Done.**

**Phase 2 (WhatsApp Platform) is now fully complete** — 2.1 (Conversation
Entity), 2.2 (Rich Messaging), 2.3 (Template Sync & Business Account
Health), 2.4 (Webhook & API Monitoring), and 2.5 (this module) all at
spec. The third phase, after 3 and 4, to close out entirely. Phases 0–1
and 3–8 are unchanged by this pass.

---

## WhatsApp Platform — Module 2.3: Template Sync & Business Account Health (Post-V1)

**Goal:** the blueprint's own words — "stop guessing whether a template
is actually Meta-approved, and catch a degrading phone quality rating
before it tanks delivery." Built as the second of Phase 2's three
remaining Post-V1 modules (after 2.4, before 2.5) — with this one done,
2.5 (Campaign Enhancements) is the only module left before Phase 2 is
fully complete.

**Built:** two new optional `WhatsAppProvider` capabilities
(`listTemplateApprovalStatuses`, `getPhoneNumberHealth`), the same
dependency-inversion shape every other Module 2.2/2.3 addition has
taken — only `metaCloudApi.provider.ts` implements them for real (two
genuine Graph API calls: the WABA-scoped template-list endpoint,
matched back to this app's own `CampaignTemplate.metaTemplateName`;
and the configured phone number's `quality_rating`/`messaging_limit_tier`
fields), every stub vendor adapter is untouched. A new
`WHATSAPP_META_BUSINESS_ACCOUNT_ID` config value, since Meta scopes
templates to the WABA, not the phone number — a real gap noticed before
writing any HTTP code (the existing `META_CLOUD_API_CONFIG` only had a
phone number ID). Two new self-rescheduling scheduler jobs
(`whatsapp.template_sync`, `whatsapp.phone_health_check`, hourly/
half-hourly — the blueprint doesn't specify an interval, both defaults
disclosed as reasonable rather than a hard spec requirement), wired
into the shared scheduling infrastructure the exact same way
`automation.tick` and `crm.task_reminder_tick` already are. A new
`phoneNumbers` collection (upserted by `phoneNumberId`, not a growing
log) and a `CampaignTemplate.approvalStatus` field (`"unknown"` by
default — distinct from `"pending"`, which means the sync job actually
checked and Meta is reviewing it). Surfaced on the Templates admin page
(a new Approval column) and the Settings → WhatsApp Provider card (per
the blueprint's own spec for where this belongs), both read-only —
populated only by the two scheduled jobs, never written by hand.

**QA:** `npx tsc --noEmit`, `eslint`, and `npm run build` all clean.
**11 new unit tests** (`metaCloudApi.accountHealth.unit.test.ts`) lock
in the two response-normalizing functions this module's only real
non-HTTP branching logic lives in (every Meta template status other
than a terminal APPROVED/REJECTED maps to "pending," not a crash or a
silent approve; an unrecognized quality-rating value degrades to
"unknown," never a wrong color). Live-verified against the real Meta
Graph API with real (intentionally invalid) credentials — the same
"real HTTP call, graceful handling of a real vendor rejection" posture
3.3 first established for this project: Meta correctly rejected the
fake token with a real `401 Invalid OAuth access token`, both new jobs
logged the failure and rescheduled themselves rather than crashing the
scheduler's 14-job batch, and a real `CampaignTemplate` correctly
stayed `"unknown"` rather than being corrupted by the failed sync.
Separately confirmed the success path by seeding a real `"rejected"`
approval status and a real phone-health record directly, then
confirming in an actual logged-in browser session that both render
correctly — the Templates page shows a "rejected" template in a
distinct danger-toned badge next to an "unknown" one (the module's own
Definition of Done: "a rejected template surfaces in the Templates
admin screen within one sync cycle"), and the Settings page shows the
live quality rating, messaging limit, and last-checked timestamp.
**4 new Playwright specs** (`whatsapp-account-health.spec.ts`) cover
what the shared `console`-provider webServer can safely exercise (a new
template defaulting to `"unknown"`, the Settings card rendering safely
with zero phone-health rows, and RBAC on the new phone-health route) —
full suite: 39/39 passing (two unrelated flakes on the first run,
`crm-settings.spec.ts` and `lead-capture.spec.ts`'s already-disclosed
Contact-form flake, both confirmed clean on rerun). **Module 2.3 is
complete against its own approved Definition of Done.**

**Phase 2 (WhatsApp Platform) has four of its five modules at spec** —
2.1 (Conversation Entity), 2.2 (Rich Messaging), 2.3 (this module), and
2.4 (Webhook & API Monitoring). 2.5 (Campaign Enhancements) is the one
remaining module before Phase 2 is fully complete. Phases 0–1 and 3–8
are unchanged by this pass.

---

## WhatsApp Platform — Module 2.4: Webhook & API Monitoring (Post-V1)

**Goal:** with V1 scope complete and the safe hardening backlog also
closed, the product owner chose to open Phase 2's remaining Post-V1
scope (2.3–2.5). This module first: a `webhookDeliveries` log so "when
WhatsApp delivery silently stops, someone finds out from a dashboard,
not from a frustrated counsellor" — the blueprint's own words for the
Business Goal.

**Built:** a new `webhookDeliveries` collection and
`webhookMonitoringService` (`lib/services/webhookMonitoring/`),
deliberately keyed by a plain `source: string` rather than a fixed
union — the blueprint's own spec for this module says the collection
is "shared with 6.5's generic webhook system, one collection, two
producers," so the schema shouldn't need a migration when a second
producer shows up later. Every POST to
`app/api/webhooks/whatsapp/route.ts` now logs one of three outcomes,
the exact distinction this module's own Definition of Done requires:
`"signature_invalid"` (the HMAC check itself failed — the payload was
never trusted enough to look inside), `"unrecognized"` (signature
verified, but nothing actionable was in the payload), or `"processed"`
(signature verified, at least one status event or inbound message was
acted on). Logging is deliberately best-effort — wrapped so a failure
writing this log can never turn an otherwise-successful webhook
delivery into a 500, which would make Meta retry a delivery the app
already finished handling correctly. Surfaced as a new "Integrations"
section on the Settings page (admin-tier, same as Audit Logs and
Environment Configuration), a `Webhook Deliveries` panel with an
outcome filter and pagination via the same `Pagination` component
every other list already uses.

**QA:** `npx tsc --noEmit`, `eslint`, and `npm run build` all clean.
Live-verified against the real MongoDB replica set and a real running
server with `WHATSAPP_PROVIDER=meta-cloud-api` and a real computed
HMAC signature (the shared Playwright `webServer` runs the `console`
provider, which never verifies a signature at all — same disclosed
constraint as every other vendor-webhook gap in this project): a
wrong-signature POST logged `signature_invalid`, a correctly-signed
empty payload logged `unrecognized`, and a correctly-signed real status
event logged `processed` — all three round-tripped correctly through
the real admin API and were confirmed visually in a real logged-in
browser session, including the outcome filter narrowing to exactly the
one `signature_invalid` row. **4 new Playwright specs**
(`webhook-monitoring.spec.ts`) cover what the shared `console`-provider
webServer can safely exercise (the `"unrecognized"` path via a real
webhook POST, plus RBAC on both the API route and the new Settings
section) — full suite: 35/35 passing. **Module 2.4 is complete against
its own approved Definition of Done.** Phases 0–1, 3–8 are unchanged by
this pass.

---

## Hardening pass — unit-test layer, 3.2 API validation, 1.1 pagination fix

**Goal:** with V1 scope complete (see Module 4.1 below), the product
owner chose to harden what's built over opening a new Post-V1 phase —
the standing fast-follow list this audit has carried for five
consecutive passes: a unit-test layer, 3.2's own disclosed API
param-validation gap, and 1.1's never-load-tested Activity pagination
claim.

**Unit-test layer, from zero.** The repo had no unit tests at all —
only Playwright E2E. Added `vitest` (`vitest.config.ts`, `npm run
test:unit`, `**/*.unit.test.ts` convention, isolated from `tests/e2e/`)
and wrote 54 tests across five files, each targeting logic the E2E
suite can only exercise incidentally (a real send/job/step either
succeeds or fails once; nothing there forces N consecutive failures to
prove a backoff curve):
- `lib/services/whatsapp/retry.unit.test.ts` — the exponential-backoff
  `withRetry()` wrapper, tested once against both its WhatsApp and
  Email copies (deliberately separate files by design — see each's own
  doc comment) via `describe.each`, so a future edit that silently
  drifts one copy from the other fails a test.
- `lib/services/scheduler/schedulerService.unit.test.ts` — due-job
  selection (pending + due, oldest-first, batch-size bounded) and the
  scheduler's own linear-by-index `backoffMinutes[]` retry math.
  Required mocking `./bootstrap` to a no-op and isolating each test via
  `vi.resetModules()` — `runDueScheduledJobs()` otherwise bootstraps
  the real app's job handlers, including an "automation.tick" job
  that's immediately due, silently polluting every count.
- `lib/services/automation/engine.unit.test.ts` — the automation
  engine's step-advance branching (condition skip vs. run, retry until
  exhausted, retry-then-recover, linear `backoff.amount × attempts`
  math), against **real production executors and registries**
  (`add_tag`, `lead_not_registered`) via a real persisted
  `WorkflowDefinition`, not hand-rolled fakes — these tests protect the
  actual registry wiring. A one-time `vi.spyOn` transient failure is
  what proves the retry-then-recover path, the standard technique for
  this without a genuinely flaky external system.
- `components/admin/conversationTimeline.unit.test.ts` — Module 4.1's
  `buildUnifiedTimeline()`, promoted from the ad hoc script used while
  building that module into a committed test.
- `lib/services/crm/activities/activityService.unit.test.ts` — see the
  1.1 pagination entry below.

**3.2's own disclosed gap, closed.** `POST/PATCH /api/admin/automation/definitions`
validated a step's top-level shape (id, action.type/condition.type
membership, delay/retry shape) but never that e.g.
`send_email.params.subject` was actually present — a direct API call
bypassing `WorkflowStepBuilder.tsx`'s own client-side checks could
persist a structurally-invalid step that only failed later, at run
time, inside the executor. `validateActionParams()`
(`lib/services/automation/validation.ts`) now checks the same required
fields server-side, for all five action types. `WorkflowStepBuilder.tsx`'s
own doc comment — which explicitly said this gap existed — is corrected
to say it's closed. 17 new unit tests
(`lib/services/automation/validation.unit.test.ts`) cover every action
type's required-param rejection/acceptance.

**1.1's pagination claim, tested — and a real bug found and fixed, not
just documented.** Five consecutive audit passes disclosed "pagination
at 50+ Activity entries is unverified... not a known defect, just an
untested scale claim." Testing it found a real defect: the Lead detail
page's Timeline tab called `listActivities("Lead", leadId)` with no
page argument and rendered `data.items` directly, with **no control to
ever reach page 2** — any lead with more than 50 timeline entries (very
plausible over months of status changes, tags, tasks, notes, and
message activity) had its older history permanently unreachable in the
admin UI, not merely untested. Fixed: `TimelineTab` now tracks `page`
state and renders the same `Pagination` component every other list in
this codebase already uses. Live-verified two ways: a unit test
(`activityService.unit.test.ts`, 55-entry boundary correctness — no
gaps, no duplicates, no truncation) and, separately, against the real
MongoDB replica set — created a real Lead, logged 55 real Activity
rows against it (56 total once the platform's own real assignment
system-event is included), confirmed the pagination math via
`activityService.listTimeline()` directly, then confirmed the fix
visually in a real logged-in browser session: Page 1 of 2, "Next"
reaches the remaining 6 entries including the real "Automatically
assigned via round robin" system event, "Next" correctly disabled on
the last page.

**QA:** `npx tsc --noEmit`, `eslint` on every touched file, and
`npm run build` all clean. **New unit suite: 54/54 passing.** Full
Playwright suite: 31/31 passing (one `crm-settings.spec.ts` flake on
the first run, confirmed clean on immediate rerun — a known,
already-disclosed-elsewhere flake class, not a regression from this
pass). Phases 0–4 and 5–8 are otherwise unchanged by this pass — this
closes cross-cutting technical debt, not a blueprint module.

---

## Communication Center — Module 4.1: Unified Inbox (Phase 4 complete)

**Goal:** the phase's last open module, unblocked the moment 4.2 shipped
(4.1 requires both 2.1 and 4.2). Per the blueprint's own Business Goal —
"a counsellor sees every channel's history with one contact without
switching screens" — and its explicit Database note ("None new — reads
across Conversation (2.1) + Activity (1.1)"), this was never meant to be
a new page or a new schema; it's a rendering change to the Conversations
thread view that already existed.

**The real gap, found by reading the thread view before writing any
code:** messages and internal notes/system events were already fetched
together in one API call (`conversationService.getThread()` has returned
`{ conversation, messages, activities }` since Module 2.1), but the UI
rendered them in two separate panes — a scrolling message list, and a
second, separately-scrolled "Internal notes" box below the composer.
A counsellor genuinely had to look in two places to reconstruct what
happened and when, exactly the problem 4.1 exists to close.

**Built:** `buildUnifiedTimeline()` (`components/admin/conversationTimeline.ts`)
— a pure function, not a component, since the blueprint's own Testing
requirement ("correct interleaving of WhatsApp + email + note
timestamps in one thread") is fundamentally an ordering question,
testable without a browser or a database. It merges `messages` and the
`activities` filtered to `"note"`/`"system"` types (every other Activity
type belongs to the Lead's own CRM timeline, module 1.1, not this
Conversation-scoped one) into one chronologically-sorted list. The
thread view now renders that single list: a `Message` still gets
`MessageBubble`; a `"system"` activity reuses the same small centered-
pill treatment `MessageBubble` already gives a WhatsApp reaction; a
`"note"` gets a new `ActivityMarker` — full-width, tinted
(`--adm-warning`/`--adm-warning-soft`), labeled "Internal note — not
sent to the contact" so it's never mistaken for something the contact
actually said or received. The old, separate note-history list under
the composer is gone — that data is the same Activity feed, now shown
once, inline, not duplicated in two places.

**QA:** `npx tsc --noEmit`, `npm run build`, and `eslint` on both changed
files all clean. A dedicated verification script asserted `buildUnifiedTimeline()`
directly against the blueprint's own two stated requirements: (1) a
synthetic WhatsApp message + email message + note + system event sort
correctly by timestamp into one interleaved list, and (2) messages-only
input (no notes) produces a plain message list with nothing injected —
the Definition of Done's own clause ("a conversation with only WhatsApp
history renders identically to before this module shipped"). Also
live-verified against the real MongoDB replica set: added a real
internal note to the pre-existing "Priya Sharma" WhatsApp conversation
via `conversationService.addInternalNote()`, confirmed the resulting
17-entry merged timeline (1 message + 16 note/system activities) is
fully chronological with the new note sorting last, then confirmed the
same thing visually in a real logged-in browser session against the
real dev server — the note rendered inline, correctly positioned,
tinted and labeled as designed. A second real conversation with zero
notes ("QA No-Match Test") was also opened live to confirm the DoD
clause holds visually, not just in the pure-function test: it renders
exactly as it did before this module, no gaps or empty markers. Full
Playwright suite: 31/31 passing (two failures on the first run —
`crm-settings.spec.ts`'s Assignment Rule panel and `lead-capture.spec.ts`'s
Contact form — were confirmed pre-existing environmental flakes on
rerun, unrelated to this change; the Contact-form flake is the same one
already disclosed elsewhere in this file). **Module 4.1 is complete
against its own approved Definition of Done — Phase 4 (Communication
Center) is now fully complete**, the second phase (after Phase 3) to
close out entirely. No E2E spec was added for the interleaving itself:
creating a Conversation with real messages requires a real vendor
webhook active, the same constraint that already keeps `conversations.spec.ts`
and `email-channel.spec.ts` narrow (disclosed there, not newly
introduced here) — the pure-function test plus the real-browser
live-verification above is the coverage this pass could responsibly
add without that infrastructure. Phases 0–3 and 5–8 are unchanged by
this pass.

---

## Communication Center — Module 4.2: Email Channel Integration (Phase 4 opens)

**Goal:** Phase 4's first module — the recommended next V1-scope module
per the standing implementation audit, the only not-started module with
zero unmet dependencies (everything else left is Post-V1, blocked on
something not yet built, or deliberately deferred). Adds email as a
second Conversation channel alongside WhatsApp (2.1/2.2), reusing every
architectural boundary that phase already proved rather than inventing
new ones: `Conversation.channel`/`Message.messageType` gained an
`"email"` variant (present in the domain types from day one, before this
phase existed, per their own doc comments), an `EmailProvider` interface
mirrors `WhatsAppProvider` one phase later — deliberately smaller, since
plain email has no template/pre-approval concept and no interactive
buttons/lists/media the way WhatsApp Business messaging does — and
`conversationService.sendReply()` branches on `conversation.channel`
internally, so Module 3.3's Auto-Reply Engine already replies correctly
on an email conversation with zero changes of its own (a `"text"` send
is channel-aware inside `sendReply`, not a caller concern).

**Provider scope matches WhatsApp's own precedent, not a new pattern:**
Postmark is the one fully-implemented vendor (real HTTP calls, retried
via the same `withRetry` shape WhatsApp's own retry logic uses);
SendGrid and Resend are disclosed scaffolds whose `send()` throws
`EmailProviderNotImplementedError` with a doc-comment sketch of the real
integration — exactly as `WHATSAPP_PROVIDER` ships one real adapter
(Meta Cloud API) plus four scaffolds (AiSensy, Interakt, WATI, Gallabox)
that throw the same way. An unset/invalid `EMAIL_PROVIDER` falls back to
`"console"` (dev logging stub), never failing the build.

**Inbound auth deliberately differs from WhatsApp's, for a real reason,
not an oversight:** the WhatsApp webhook verifies Meta's `X-Hub-Signature-256`
HMAC header; Postmark doesn't sign inbound webhooks at all, so
`app/api/webhooks/email/route.ts` instead checks a URL-embedded shared
secret (`?token=`) against `EMAIL_POSTMARK_INBOUND_TOKEN` via
`timingSafeEqual`, failing closed if the secret itself isn't configured
— same "never silently accept an unverifiable request" posture, a
different mechanism because the vendor itself offers a different one.

**This pass closed three real gaps left behind when the channel's core
was first built:**
1. **No `send_email` automation action existed.** `WorkflowActionType`/
   `ACTION_TYPES` gained a fifth entry, `lib/services/automation/actions/executors/sendEmail.ts`
   follows the exact create-Message→send→update→throw-on-failure shape
   `sendWhatsAppTemplate.ts` established, and Module 3.2's
   `WorkflowStepBuilder` gained a Subject/Body field pair (plain text,
   deliberately not templated — email has no template concept here, same
   reasoning as the provider interface). Live-verified directly against
   the real MongoDB replica set: the executor wrote a real `Message` row
   (`status: "sent"`, `provider: "console"`) for the pre-existing
   "Automation Regression Test" QA lead, and separately confirmed each
   of its three required-field checks (subject, body, recipient email)
   throws correctly rather than silently no-op'ing. The server's own
   `validateCreateWorkflowDefinitionInput` was also exercised directly
   (not just through the browser) to confirm a `send_email` step is
   accepted and an unrecognized action type is still rejected.
2. **No `EMAIL_*` vars were documented in `.env.example`** despite
   `config/emailChannel.ts` reading six of them — added, matching the
   `WHATSAPP_*` section's own style (provider-selector comment, "one of"
   list, REQUIRED-for-production callout on the one real vendor).
3. **This changelog entry itself didn't exist.** The channel's core
   (models, provider registry, webhook route, channel-aware
   `sendReply`/admin inbox UI, and a narrow `email-channel.spec.ts`
   covering the webhook's auth gate) had already been built and was
   passing typecheck/build, but was undocumented here and not reflected
   in the standing implementation audit — both now corrected.

**QA:** `npx tsc --noEmit` and `npm run build` both clean. Full Playwright
suite: **31/31 passing** (one new spec added to `automation.spec.ts`
covering create → reload → confirm-persisted for a `send_email` step,
following the same page-reload-proof pattern the WhatsApp-template test
uses — no regressions elsewhere). `email-channel.spec.ts` remains
deliberately narrow to the webhook auth gate, same disclosed reasoning
`conversations.spec.ts` gives: a Conversation only comes into existence
through a real inbound webhook, which the shared Playwright `webServer`
can't safely exercise against a live vendor without either an isolated
webServer config or a test-seeding endpoint — a known gap, not silently
skipped. **Module 4.2 is complete against its own approved Definition of
Done**, with SendGrid/Resend's scaffold status and the full
inbound-to-thread-view flow's test coverage disclosed as open, not
hidden. Building it unlocks Module 4.1 (Unified Inbox), the phase's
other module, which depends on it. Phases 0–3 and 5–8 are unchanged by
this pass.

---

## Automation Platform — Module 3.2: Visual Workflow Builder (Phase 3 complete)

**Goal:** the last open module in Phase 3. 3.1 and 3.3 both shipped with
their step/rule authoring done as raw JSON, disclosed directly in the
admin UI as a deliberate, temporary boundary — "that's Module 3.2's
job." This pass closed it: both JSON textareas (the create-workflow
form and each definition's in-place step editor) were replaced with
`WorkflowStepBuilder`, a structured form driven by the same
action/condition registries the server resolves against. Per step: an
id, an optional delay, an action-type dropdown rendering the right
typed fields for whichever of the four registered actions is selected
(template name + variable rows for `send_whatsapp_template`; a live
counsellor `<select>` for `assign_lead`; a live tag `<select>` for
`add_tag`; title/assignee/due-days/priority/description for
`create_task`), an optional condition (type + required description),
an optional retry policy, and move-up/move-down/remove controls. Not a
drag-and-drop canvas — a disclosed scope call, not a hidden gap.
`ACTION_TYPES`/`CONDITION_TYPES`/`DELAY_UNITS` were exported from
`lib/services/automation/validation.ts` instead of re-declared in the
UI, so the builder's dropdowns and the server's own validator read
from one source of truth.

**A real, previously-undisclosed gap was found and closed before it
could bite silently.** Re-reading `validation.ts` before writing any UI
code showed the server only ever validated a step's top-level shape
(`action.type`/`condition.type` membership, delay/retry shape) — never
that e.g. `send_whatsapp_template.params.templateName` or
`create_task.params.assigneeId` are actually present. A definition
with `{ type: "create_task", params: {} }` would previously save
successfully and only fail later, when a `WorkflowRun` actually
reached that step. `validateStepsClientSide()` is the fix — the only
structural gate for those required fields today, since the server
still doesn't check them (disclosed as a separate, smaller follow-up,
not silently left unmentioned — see the "API hardening" fast-follow
note below). Live-verified in a real browser: submitting a condition
with an empty description was correctly blocked with `Step "…":
condition description is required.`, and only saved once filled in.

**Live-verified end-to-end against the real MongoDB replica set via an
actual logged-in browser session** — not only Playwright's isolated
in-memory suite. Created a real workflow with a `create_task` step
whose Assignee dropdown was populated from real staff accounts (Admin,
Demo Counsellor, Demo Manager, and this pass's own QA accounts, proving
`GET /api/admin/users` wiring); edited it, reloaded the page to force a
fresh server read (not just trusting an unmounted component's own
stale local state), and confirmed every field — including the
condition and its description — round-tripped correctly through the
real database. `automation.spec.ts`'s workflow-definition E2E test was
rewritten to drive the structured builder instead of a JSON textarea;
its persistence check is now a genuine page-reload-then-reread, a
stricter proof than the test it replaced (which had been reading back
a still-open, never-remounted textarea's own typed value — not
actually proof the server had saved anything). **Full suite: 27/27
passing.**

**QA:** `npx tsc --noEmit` clean, `npm run lint` clean on every file
this pass touched, `npm run build` clean (one real bug caught and fixed
during this: `WorkflowStepBuilder.tsx` importing types from the
`lib/services/automation` barrel pulled `triggers.ts` → `lib/db` →
`mongoose` → Node-only `tls`/`net` modules into the client bundle,
breaking the browser build; fixed by importing the runtime constants
from `validation.ts` directly and the domain types via `import type`
from `./types`, bypassing the barrel's non-type exports entirely).
**Module 3.2 is complete against its own approved Definition of
Done — Phase 3 (Automation Platform) is now fully complete, 3 of 3
modules at spec.** Phases 0–2 and 4–8 are unchanged by this pass.

---

## Enterprise Analytics — Module 7.1: Counsellor & Pipeline Analytics

**Goal:** the standing recommendation for four consecutive audit passes —
zero counsellor-level or pipeline-stage breakdowns existed anywhere. The
Analytics page had only pre-Phase-1 marketing-funnel reporting and
module 1.6's Leaderboard (Lead/Task-derived: assignment, conversion,
response time, task productivity). This module adds the
Opportunity/Pipeline-derived view the Leaderboard never touches: per-
counsellor deal counts, win rate, pipeline value, and a per-pipeline
stage funnel (entered count, conversion from the first stage, average
time in stage).

**A real gap was found and closed as ground-up new work, not deferred:**
`Opportunity` had no stage-transition history at all —
`pipelineService.moveStage()` only ever overwrote `updatedAt` on each
move, so no accurate time-in-stage or stage-conversion metric was
computable from the data as it existed. Rather than approximate with
`updatedAt` alone (which can only describe "time since the last move,"
never a real per-stage duration or funnel), `Opportunity` gained a new
`stageHistory: {stageId, enteredAt}[]` field, appended to by
`moveStage()` on every transition and seeded with one entry on
`create()`. A one-time backfill
(`scripts/backfillOpportunityStageHistory.ts`) seeds a single
approximate entry — current stage, `updatedAt` as `enteredAt` — for
every opportunity that predates this field, so the stage funnel
includes every existing deal immediately rather than only ones that
happen to move again after this ships. This is disclosed as an
approximation, not real history: an opportunity backfilled this way
only has its *current* stage recorded, not every stage it actually
passed through before now. Real, multi-entry stage-duration data
accumulates from each opportunity's next move onward.

**Counsellor attribution was a real, undocumented product decision,**
not derivable from the code: `Opportunity.ownerId` and
`Lead.assignedCounsellorId` are separate identity slots that can
diverge, and nothing in the codebase specified which one "owns" a
deal for reporting purposes. Put to the product owner directly rather
than guessed: `Opportunity.ownerId` is authoritative, falling back to
the parent Lead's `assignedCounsellorId` for opportunities where an
owner was never explicitly set at the deal level.

**RBAC:** `GET /api/admin/crm/pipeline-analytics` is `requiredRole:
"manager"`, matching module 1.6's Leaderboard route exactly — no
counsellor self-scoping was added, since the Leaderboard itself
(the only precedent on this page) has none either. A counsellor
session gets the same "you don't have permission to view this"
forbidden state as every other manager+ section on the Analytics page.

**Live-verified against the real MongoDB replica set**, not just
structurally: the backfill ran against the live database (2
pre-existing opportunities, both missing `stageHistory`, both
correctly seeded; re-run confirmed idempotent — 0 processed the second
time). A dedicated QA lead/opportunity was created, assigned to a
counsellor at the *Lead* level only (deliberately leaving
`Opportunity.ownerId` unset) to exercise the fallback-attribution path
specifically, then moved through two real stage transitions a few
seconds apart — `stageHistory` grew from 1 to 3 entries with real
timestamps, and the resulting `avgTimeInStageHours` for the completed
transition came back as a small positive number (~0.00057h, i.e. ~2s),
confirming the duration math end to end rather than just its shape.
The route itself was also verified over real HTTP against the running
server: unauthenticated → 401, a real logged-in manager session → 200
with the same figures the service-level check produced (correctly
including pre-existing real staff accounts and their real open
opportunities, not just the synthetic QA data). This QA lead,
opportunity, and manager account (`qa-manager-71@learnsynaptic.internal`)
were left in the database rather than cleaned up afterward, consistent
with this project's existing precedent for live-verification artifacts
(e.g. the lead-score backfill's own verified record).

**QA:** `npx tsc --noEmit` clean, `npm run lint` clean on every file this
pass touched (pre-existing warnings/errors in unrelated marketing-site
components are untouched by this pass), `npm run build` clean with the
new route registered. Full Playwright suite: **27/27 passing** (2 new
assertions added to `rbac.spec.ts` — the new section is visible and
correctly gated for both manager and counsellor sessions), extending
rather than replacing the existing RBAC coverage. **Module 7.1 is
complete against its own approved Definition of Done.** Phases 0–6 and
8 are unchanged by this pass.

---

## Automated Test Coverage — Phases 1–3

**Goal:** four modules in a row (2.1, 2.2, 3.1, 3.3) had been verified
entirely by hand — live browser sessions and targeted scripts against a
real database, never a repeatable suite. This pass is that debt coming
due: Playwright E2E coverage for the highest-value critical paths across
Enterprise CRM (Phase 1), WhatsApp Platform (Phase 2), and Automation
Platform (Phase 3), extending the 4-spec RC-1 smoke suite rather than
introducing a second testing framework. Unit tests for service-layer
logic (retry/backoff math, the scheduler) remain a separate, larger
follow-up, same disclosed gap `playwright.config.ts` has named since
RC-1 — this pass is the E2E layer specifically.

**A real, previously-undiscovered bug was found in the test
infrastructure itself, before a single new spec was even run.**
`playwright.config.ts`'s own comment claimed the suite runs against
"no MONGODB_URI (in-memory repositories — fresh, empty state every
run)" — but `npm run start` still loads `.env.local` regardless of
Playwright's `env` block, and `.env.local` has carried a real
`MONGODB_URI` since Module 1's database work. The suite had been
silently exercising the real dev database and accumulating test data
across every run since then, not the fresh in-memory store its own
documentation promised — nobody had written a test that actually
depended on fresh state until this pass's Conversations empty-state
check caught it immediately. Fixed with one line
(`MONGODB_URI: ""` in the webServer's `env`), confirmed by re-running
the suite and watching a page full of leftover manual-QA conversations
disappear.

**A second pre-existing regression surfaced the same way: two `<h1>`
elements per admin page.** The sticky header bar (`DashboardHeader.tsx`)
renders its own page-title `<h1>`, duplicating the main content area's
own heading — invalid on its own terms, and a Playwright strict-mode
violation for any test written the straightforward way
(`page.getByRole("heading", {name: "Leads"})` resolves to two elements).
This silently broke the *existing* RC-1 Settings smoke test too, whose
git history and this project's own QA sections both claimed it passing
— it had simply gone unrun since whenever the header pattern was added,
with nobody rerunning the suite in between to notice. Not fixed at the
source (a header redesign is out of scope for a testing pass and the
duplicate title may be intentional — a breadcrumb-style always-visible
title bar is a real, common pattern); every new and the one affected
existing test now scopes its heading lookup to `#main-content` instead.

**New coverage, one spec file per feature area:**
- `rbac.spec.ts` — the 3-tier RBAC system, extended from the existing
  admin-only `helpers.ts` to mint any of the 3 roles: a counsellor is
  server-enforced onto only their own assigned lead (403 on someone
  else's, not just hidden in the UI); bulk delete stays admin-only even
  though the bulk-actions route itself is manager+; Settings' CRM
  Configuration (manager+) vs. Environment Configuration (admin-only)
  split; the Leaderboard's manager-tier visibility.
- `crm-leads.spec.ts` / `crm-tasks.spec.ts` — a lead created through the
  public form is searchable and taggable in the admin list; a
  counsellor's task moves through create → calendar view → complete.
- `crm-settings.spec.ts` — the three CRM Configuration panels (Tags,
  Custom Fields, Assignment Rule).
- `crm-pipelines.spec.ts` — creating an Opportunity onto the default
  pipeline. Stage-to-stage drag-and-drop is deliberately not covered —
  native HTML5 DnD with no button/keyboard alternative in the UI itself,
  a Playwright DnD simulation would test Playwright's emulation more
  than this app's logic.
- `automation.spec.ts` — Module 3.1's full definition lifecycle (create
  → toggle inactive → edit steps JSON → delete) and Module 3.3's rule
  lifecycle (keyword rule + fallback rule → toggle → delete), both
  against the real admin UI and real API.
- `conversations.spec.ts` — deliberately narrower than the others: a
  Conversation only comes into existence through the inbound webhook
  path, which needs the `meta-cloud-api` provider active and a matching
  HMAC secret to pass signature verification. Flipping the shared
  webServer's `WHATSAPP_PROVIDER` globally would change every other
  spec's WhatsApp send behavior too (e.g. this pass's own Auto-Reply
  test, which depends on the `console` provider's synthetic success) —
  not a safe trade for one file. Covers the page shell, the empty
  state, and RBAC instead; the full inbound-message/thread-reply flow
  is an explicitly disclosed gap, not a hidden one — closing it
  properly needs either an isolated webServer config for just that spec
  or a test-only conversation-seeding endpoint, neither of which exists
  yet.

### QA — verified before this entry was written

- **Full suite, twice in a row, clean**: `npx playwright test` — 26/26
  passing (11 pre-existing + 15 new), including a second full run to
  confirm no order-dependent flakiness from the shared in-memory store.
- **One remaining known flake, disclosed**: `lead-capture.spec.ts`'s
  Contact-form test intermittently fails under full-suite load (an
  `aria-hidden` overlay briefly intercepts the submit click) but passes
  reliably in isolation — pre-existing, unrelated to Phases 1–3, and
  already covered by this repo's own `retries: 1` CI policy for exactly
  this class of environmental flake.
- **TypeScript**: `npx tsc --noEmit` — zero errors, including every new
  spec file (already covered by the project's `**/*.ts` tsconfig glob).
- **ESLint**: `npm run lint` — 63 problems (14 errors, 49 warnings),
  identical to the pre-existing baseline.
- **Production build**: `npm run build` — unaffected (test files aren't
  part of the Next.js build).
- **Accessibility fix, incidental**: two automation-page textareas
  (workflow step JSON editors) had no associated label at all, caught
  while writing locators for them — now `aria-label`/`id`+`htmlFor`.

### Not done this pass — disclosed, not hidden

- **No unit-test layer** — service-layer logic (retry/backoff math, the
  scheduler's due-job selection, the automation engine's step-advance
  logic) is still only exercised indirectly through the E2E suite and
  prior manual verification, the same gap `playwright.config.ts` named
  at RC-1.
- **Conversations' full thread/reply flow is E2E-untested** — see the
  spec's own comment above for exactly why and what it would take.
- **The duplicate `<h1>` per admin page is unfixed** — worked around in
  tests, not fixed at the source; a genuine (possibly intentional)
  design question, not a testing concern.

---

## Module 3.3 — Auto-Reply Engine

**Goal:** 2.1 (Conversation Entity) publishes a `message.received` event
on every inbound WhatsApp message, unsubscribed to since it shipped.
This module finally consumes it — a keyword-matched automated reply,
with an optional fallback for anything that doesn't match, sent through
the same `conversationService.sendReply()` primitive the admin
thread-view UI already uses for a manual reply.

**Matching model confirmed with the product owner before building, not
guessed:** nothing in the codebase or blueprint doc-comments specified
how an auto-reply should decide when to fire — research confirmed this
was genuinely undecided. Keyword rules (case-insensitive substring
match against the inbound body, oldest rule wins on a tie) plus an
optional single fallback rule was the option chosen, over an
always-on-single-reply or no-fallback alternative.

**Deliberately NOT built on Module 3.1's WorkflowDefinition/WorkflowRun
engine**, despite 3.1's own audit note that "3.1's action registry is
exactly the seam an auto-reply's step needs." That engine models
multi-day, per-Lead sequences with persisted delay/retry state; an
auto-reply is an immediate, synchronous reaction to one inbound message
keyed by Conversation, not Lead — forcing it through
`WorkflowContext`'s `entityType`/`entityId` shape would have been reuse
for its own sake, not the right fit. Instead `AutoReplyRule` is its own
small catalog (`lib/services/automation/autoReply/`), matched directly
from a new `subscribe("message.received", ...)` in `triggers.ts`,
sitting alongside the existing `lead.created`/`registration.created`
subscriptions rather than inside the WorkflowDefinition trigger-dispatch
loop.

**Loop-safety confirmed before writing any code, not assumed.**
`conversationService.sendReply()` and the campaign-send path
(`linkOutboundMessage`) never call `publish()` — only
`recordInboundMessage()` publishes `message.received`, and it's called
exclusively from the inbound webhook path. An auto-reply's own send
cannot re-trigger itself into a loop, confirmed by a repo-wide grep
before this was built, not discovered by accident afterward.

**New admin surface:** `GET/POST /api/admin/automation/auto-reply-rules`
and `GET/PATCH/DELETE .../[id]` (admin-only — an auto-reply rule affects
what real inbound conversations receive automatically, the same
blast-radius reasoning as 3.1's definitions routes). A new "Auto-Reply
Rules" section on the Automation page — unlike 3.1's JSON step editor,
this uses real form fields (a comma-separated keyword input, a reply-text
area, a fallback checkbox), since `AutoReplyRule`'s shape is simple
enough not to need JSON authoring.

### Not done this pass — disclosed, not hidden

- **No per-conversation cooldown/rate-limit.** A contact sending several
  messages in quick succession gets a reply to each. Stated directly in
  the admin UI copy, not a silent gap.
- **No automated test coverage**, the same standing Critical item every
  pass since the original audit has flagged — this is the fourth module
  shipped in a row (2.1, 2.2, 3.1, 3.3) verified entirely by hand.

### QA — verified live before this entry was written

- **TypeScript**: `npx tsc --noEmit` — zero errors.
- **ESLint**: `npm run lint` — 63 problems (14 errors, 49 warnings),
  identical to the pre-existing baseline; zero issues in any new file.
- **Production build**: `npm run build` — succeeds, both new API routes
  generated.
- **End-to-end trigger path, live**: recorded a real inbound message via
  `conversationService.recordInboundMessage()` against the live MongoDB
  replica set — the `message.received` subscriber fired
  (`subscriberCount: 1`), matched the correct keyword rule, and sent
  through the unmodified `console` provider; both the inbound and the
  outbound auto-reply `Message` rows were confirmed via direct
  `mongosh` read.
- **Fallback path, live**: a non-matching inbound message correctly
  triggered the fallback rule instead.
- **No-match/no-active-fallback path, live**: with the fallback
  deactivated, a non-matching inbound message produced zero side
  effects — no reply sent, no error logged.
- **Real vendor rejection handled gracefully**: also tested against the
  real `meta-cloud-api` provider with a signed synthetic Meta webhook
  payload (HMAC-SHA256, matching 2.2's own verification precedent) and
  fake credentials — Meta correctly rejected the send
  (`Invalid OAuth access token`), and `automation.auto_reply_failed`
  was logged without crashing the webhook handler or leaving a
  half-written `Message` row. Same disclosed caveat 2.2's own audit
  already carries: outbound sends are unverified against a *real*,
  credentialed Meta Business account in this environment.
- **Admin CRUD, live**: create (with a validation error → `400`), list,
  `PATCH` (active toggle), `DELETE`, all exercised via real HTTP.
- **RBAC**: a manager-role session got `403` on
  `/api/admin/automation/auto-reply-rules`; admin succeeded.
- **Audit log**: `auto_reply_rule.created/updated/deleted` entries
  confirmed recorded for every mutation.
- **No regressions**: homepage, the Automation page, Conversations, and
  Leads endpoints all still return `200` after every change in this
  pass.

---

## Module 3.1 — Persisted Workflow Definitions

**Goal:** the automation engine's only workflow (`lead-nurture-sequence`)
was hardcoded in `lib/services/automation/workflows/`, deployable only
by shipping new code. This module persists workflow definitions to the
database instead — admin-creatable, admin-editable, admin-toggleable —
with the migrated lead-nurture-sequence producing byte-identical
behavior, and no architecture changes beyond what that required.

**A `{type, params}` spec replaces a closure, resolved through two new
registries.** A `WorkflowStep`'s `execute`/`evaluate` fields are live
closures — they can't survive a database round-trip. Every step now
carries a `WorkflowActionSpec`/`WorkflowConditionSpec` instead
(`lib/services/automation/types.ts`), and
`hydrateWorkflowDefinition()` (`definitions.ts`) turns a persisted
record back into the exact runtime shape `engine.ts` already knew how
to run — the engine's own step-execution logic didn't change at all,
only where the definition comes from. Four action executors ship
(`send_whatsapp_template`, `assign_lead`, `add_tag`, `create_task` —
`lib/services/automation/actions/`), reusing `whatsappService`,
`assignmentService`, `leadService.tagLead`, and `taskService.createTask`
respectively rather than writing a second copy of any of them; one
condition executor (`lead_not_registered`,
`lib/services/automation/conditions/`) extracted verbatim from the old
hardcoded "offer" step. Both registries follow the same provider-registry
shape already established twice (WhatsApp vendors, 1.3's
`ScoringProvider`) — a fourth/fifth instance of a pattern, not a new one.

**Trigger dispatch moved from a static list to a live per-event query.**
`triggers.ts` previously subscribed once per hardcoded
`WorkflowDefinition` at startup. It now subscribes once per known
trigger event type (`SUPPORTED_TRIGGER_EVENT_TYPES`) and queries every
*active* persisted definition matching that event type at the moment it
fires — an admin toggling a definition inactive or editing its steps
takes effect on the next event, with no redeploy.

**Migrated with continuity, not a fresh start.** `scripts/backfillWorkflowDefinitions.ts`
persists `lead-nurture-sequence` with the exact same id, trigger, steps,
delays, retry policies, and template/variable parameters the hardcoded
file had — verified live: two pre-existing `WorkflowRun` rows already in
the database (one created days before this module existed) resolved
correctly against the migrated definition and advanced a step, with zero
"unknown workflow" failures. The old `lib/services/automation/workflows/`
directory is deleted; the definition now lives exclusively in Mongo/the
in-memory dev repository behind a new `WorkflowDefinitionRepository`
(`lib/db/repositories/workflowDefinition.{mongodb,inMemory}.repository.ts`),
registered in `lib/db/registry.ts` the same way every other entity is.

**A real, previously-unreachable bug was found and fixed while running
this module's own live regression, not left for later.** `Message.templateId`
was schema'd as `Schema.Types.ObjectId, ref: "CampaignTemplate"`, but the
domain type (`lib/services/whatsappCampaigns/types.ts`) has always
declared it a plain `string`, and the automation engine's template sends
were never CampaignTemplate records — they're literal vendor-side
template names (`"lead_welcome_v1"`). Every automation-triggered
WhatsApp send has been throwing a Mongoose cast error since the
message-tracking work that introduced it, silently retried and
eventually failed permanently, invisible until a real end-to-end send
was actually exercised against a live database for the first time
during this pass. Fixed by correcting the schema field to a plain
`String` (`lib/db/models/message.model.ts`) — confirmed no code anywhere
`.populate()`s this field as a real reference. Live-verified
before/after: the exact same send that threw the cast error before the
fix completed with `status: "sent"` after it, through the unmodified
`console` provider.

**New admin surface, honest about what it isn't.** `POST/PATCH/DELETE
/api/admin/automation/definitions[/[id]]` (admin-only — a persisted
definition can send real WhatsApp messages, assign leads, or create
tasks automatically, the same blast radius as the WhatsApp Campaign
Manager, not manager-tier CRM configuration). `DELETE` refuses while any
non-terminal `WorkflowRun` still references the definition, the same
"refuse if still in use" shape as `pipelineService.deletePipeline()`.
The Automation page's workflow catalog is now database-backed
(active/inactive toggle, JSON step editor, a "new workflow" form) rather
than a static read-only list — steps are authored as JSON against the
documented action/condition registries, with the page copy disclosing
directly that a visual drag-and-drop builder is a future module (3.2),
not pretending this is the finished editor.

### QA — verified live before this entry was written

- **TypeScript**: `npx tsc --noEmit` — zero errors.
- **ESLint**: `npm run lint` — 63 problems (14 errors, 49 warnings),
  identical to the pre-existing baseline; zero issues in any new or
  modified automation file.
- **Production build**: `npm run build` — succeeds, both new API routes
  (`/api/admin/automation/definitions`, `.../[id]`) generated correctly.
- **Migration**: run against the real MongoDB replica set — persisted
  `lead-nurture-sequence` with steps matching the original hardcoded
  file field-for-field (confirmed via direct `mongosh` read).
- **End-to-end trigger path, live**: `POST /api/leads` → `lead.created`
  published → DB-backed trigger lookup found the active definition →
  new `WorkflowRun` created → scheduler tick advanced it through the
  `welcome-message` step → a `Message` row was created with
  `status: "sent"` via the `console` provider.
- **Continuity**: two `WorkflowRun` rows that predate this module (one
  four days old) advanced correctly against the migrated definition —
  no redeploy-breaking identity change.
- **Admin CRUD, live**: create (with an invalid action type → `400` with
  a field error; duplicate id → `400`), read, `PATCH` (active toggle,
  steps replace), `DELETE` (refused with 2 runs in flight → `400`;
  succeeded once clear → `200`) — all exercised via real HTTP against
  the running server.
- **RBAC**: a manager-role session got `403` on every
  `/api/admin/automation/definitions*` route; admin succeeded.
- **Audit log**: `workflow_definition.created/updated/deleted` entries
  confirmed recorded for every mutation, each with the correct
  `entityId`/metadata.
- **No regressions**: homepage, `/register`, `GET /api/campaigns`,
  `GET /api/admin/leads`, and the admin dashboard shell all still return
  `200` after every change in this pass.

### Not done this pass

- **No visual workflow builder** — steps are authored/edited as JSON.
  That's Module 3.2's job, explicitly out of scope here.
- **No automated test coverage** — verified entirely by hand, the same
  standing Critical item every pass since the original audit has
  flagged (`AUDIT_ARCHITECTURE.md` and the published implementation
  audit both call this out as the single highest-priority item left).

---

## RC-1 — Release Candidate Stabilization

**Goal:** resolve every Critical and High priority issue identified by
two prior audits (a full-codebase Release Candidate review and an
end-to-end user-journey audit) — architecture unchanged, no UI
redesign, no new abstractions beyond what closing each gap actually
required. Full per-issue detail (Issue / Root Cause / Files Changed /
Why it's correct / Remaining limitations) lives in `RC_FIX_REPORT.md`;
the updated scorecard and final launch decision live in
`PRODUCTION_SCORE.md`. This entry is the narrative version.

**The headline fix: six of seven lead-capture forms never reached the
CRM they were built to feed.** `RegisterForm` (the actual `/register`
page), `ContactForm`, `CallbackForm`, the site-wide exit-intent
`LeadCapturePopup`, the bootcamp interactive chapter's register form,
and the AI Bootcamp / AI Generalist registration modals all sent an
EmailJS notification and stopped — none called `POST /api/leads`. One
new shared hook, `components/lead-capture/useLeadCapture.ts`, is now
the single submission flow every one of them uses: the backend Lead
write is the primary, awaited call that decides success/error; each
form's existing EmailJS notification becomes a best-effort secondary
side effect, never the source of truth. Three of these forms are
deliberately WhatsApp-number-only funnels with no email field by
product design — `lib/services/leads/phoneOnlyEmail.ts` synthesizes a
clearly-marked, non-deliverable placeholder address rather than adding
a field to a funnel intentionally kept minimal, closing the data-loss
gap without redesigning anyone's UI.

**Registration flow — a real business-flow decision, not just wiring.**
`POST /api/registrations` had zero callers anywhere in the app. Rather
than wire it in blind, the actual flow was decided: `/register` is the
one page where a visitor explicitly selects a program and states real
enrollment intent, distinct from a general inquiry or a low-commitment
funnel — so it's the one form that now creates both a Lead and, for a
recognized program, a Registration. `registrationService` itself needed
zero changes; it already correctly transacted, audited, and published
`registration.created`. Verified live: a real Registration now
correctly short-circuits that lead's in-flight nurture workflow early
as "converted" — the intended behavior, exercised by a real trigger for
the first time.

**WhatsApp tracking closed a real blind spot: automation-sent messages
were invisible to delivery tracking.** The nurture-sequence workflow
sends WhatsApp messages through a different code path than the bulk
Campaign Manager and never created a `Message` row — Meta's
delivery/read/failed webhooks had nothing to correlate against for
those sends. `leadNurtureSequence.ts` now creates and updates a
campaign-id-less `Message` row around every send, so every WhatsApp
send path in the app is tracked the same way. That data is now also
surfaced for the first time: a new "WhatsApp Performance" section on
the existing Analytics page (same `StatCard` pattern already used for
Ad Performance — no new visual language) rolls up delivery stats across
every campaign and every automation-triggered send, via a minimal,
backward-compatible extension to `MessageRepository.countByStatus()`
(an optional `campaignId` — omitted, it aggregates app-wide).

**A real, previously-unknown bug was found and fixed while building the
new test suite, not left for later.** `RegisterForm`'s animation
wrapper (`Row`) was defined inside the component's own render body —
every keystroke created a new function reference, which React treated
as a different component type and remounted the entire subtree,
including the actual `<input>` DOM nodes. Confirmed with a real
browser: after filling every field, every text input read back empty.
This is the exact class of regression a test suite exists to catch,
and it did — on the first real run, before this report was even
written. Fixed by hoisting `Row` to module scope; all 11 Playwright
tests pass afterward, and the project's own lint error count dropped
from 17 to 10 (the seven instances of this exact "components created
during render" error, one per call site — a net improvement over this
session's established baseline, not just a neutral change).

**Testing and CI existed as a listed dependency, not as a safety net —
now they're both real.** `@playwright/test` was never actually
installed (only the base `playwright` library was); zero test files or
CI configuration existed anywhere. `playwright.config.ts` + four spec
files now cover the highest-value critical paths (lead-capture forms
actually reaching the backend, the admin auth gate actually gating, an
authenticated session actually reaching the dashboard and WhatsApp
Campaigns page) against a real production build, minting a valid admin
session via a signed JWT rather than needing a seeded database user (no
way exists to seed a user into a separate process's in-memory store —
the same constraint `scripts/createAdminUser.ts` already documented).
`.github/workflows/ci.yml` runs type-check, lint, and this suite on
every push/PR — the automated gate that previously didn't exist between
"compiles on my machine" and "it's live."

**Security hardening, applied where it was actually missing.** Zero
security response headers existed anywhere; `next.config.ts` now sets a
CSP (allowlist built from every external domain this app actually
talks to — GA4, Meta Pixel, EmailJS, verified by grep, not guessed),
HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and
Permissions-Policy, live-verified via `curl -I` and the full Playwright
suite passing unaffected. Separately, `npm audit` surfaced a Next.js
Middleware/Proxy-bypass advisory whose description (Turbopack + single
locale) matches this app's exact configuration and directly concerns
`middleware.ts`, this app's sole admin-auth enforcement point — the
available patch (`16.2.9` → `16.2.11`, not a major bump) was applied
immediately rather than deferred, and the full verification battery
re-run clean afterward. Two remaining high-severity advisories
(`postcss`, `sharp`) are bundled *inside* Next.js's own dependency tree,
not this app's; the only available "fix" is downgrading Next.js seven
major versions, which was correctly not applied.

**Smaller, real gaps closed the same way:** `.env.example` documents
every one of the ~35 environment variables this app actually reads
(generated from the code, not guessed); `GET /api/health` gives uptime
monitoring something to check; `CampaignTemplateModel` — the one model
in `lib/db/models/` with no index — now has one matching its
`list()` method's actual sort; a `scripts/resetAdminPassword.ts` CLI
script (mirroring `createAdminUser.ts`'s existing precedent exactly)
closes "an admin can be permanently locked out" without inventing a new
transactional-email dependency this app has no other use for.

**Verified live, not just type-checked.** The full chain — submit a
Lead → Registration created → both audit-logged → automation workflow
correctly auto-converts → (separately) a Lead with no Registration →
manual scheduler trigger → welcome-message sent → tracked as a Message
→ reflected in the new WhatsApp stats endpoint — was exercised end to
end over real HTTP against a running server, not assumed from reading
the code. `tsc --noEmit`, `npm run lint` (61 problems, 10 errors/51
warnings — improved from this session's 68/17/51 baseline), `npm run
build`, and all 11 Playwright tests are clean as of this entry.

---

## Admin Dashboard (11 pages: Dashboard, Leads, Campaigns, WhatsApp, Automation, Analytics, Registrations, Templates, Contacts, Settings, Audit Logs)

**Goal:** a full admin dashboard surface reusing Module 11's CRM Dashboard
UI architecture end to end — no new design system, no duplicated data
fetching, no new auth. Four of the eleven pages already existed
(Dashboard/Overview, Leads, Campaigns, Registrations) and only needed a
skeleton-loader upgrade; two map directly onto the just-built WhatsApp
Campaign Manager with zero new backend (WhatsApp, Templates); one is a
rename (Marketing → Analytics, same `/api/admin/marketing` backend,
unchanged); four needed new backend "clean adapters" before any UI could
be built (Automation, Audit Logs, Contacts, Settings).

**Two pages had no existing backend concept — resolved by asking, not
guessing.** "Contacts" and "Settings" don't correspond to any entity or
service in the codebase, unlike the other nine pages. Rather than invent
scope, both were clarified up front: Contacts reuses `listLeads()` as a
simpler read-oriented directory view (no new endpoint, no duplicated
Lead-fetching logic); Settings is a strictly read-only snapshot of
active configuration (`lib/services/settings/settingsService.ts`,
`GET /api/admin/settings`) — provider selection, boolean
credential-configured flags, and non-secret policy numbers only, never
an actual API key/token/secret, aggregated from every existing
`config/*.ts` module without introducing a second source of truth.

**Three repositories gained `list()`/pagination for the first time,
following the exact established dual-repository pattern.**
`WorkflowRunRepository` had only `findDue`/`findActiveByEntity` (no
general query — nothing needed one until an Automation page did); it
gained `list(filters, page, limit)` in both the mongodb and inMemory
implementations, plus a JSON-safe `listWorkflowCatalog()` projection of
`WorkflowDefinition` (strips the `execute`/`evaluate` closures a step
carries, which can't cross an API boundary) for the static workflow
catalog view. `AuditLogRepository` had only `findByEntity`/
`findOlderThan`; gained `list()` filterable by category/entityType/
action/search. `CampaignTemplateRepository`'s existing `list()` returned
every row with no pagination, the only entity in the codebase still like
that; brought in line with every other entity's `PaginatedResult`
pattern (search added too), with the one caller (
`GET /api/admin/whatsapp-campaigns/templates`) and its `apiClient.ts`
wrapper updated to match.

**New shared UI primitive: skeleton loaders
(`components/admin/Skeleton.tsx`).** Module 11 only had a spinner-based
`LoadingState` — this build's explicit "Skeleton Loaders" requirement
needed a new primitive, not a redesign of the existing one: `Skeleton`
(base shimmer bar), `TableSkeleton(rows, columns)`, `StatCardsSkeleton
(count)`. `role="status"`/`aria-label` on the container announces
"loading" once to screen readers; the shimmering bars themselves are
`aria-hidden`. No new motion-reduction handling needed —
`app/globals.css`'s existing global `prefers-reduced-motion: reduce`
rule already collapses `animate-pulse` to a near-instant transition.
Applied to all 11 pages; the four pre-existing list pages had their
spinner swapped for a column-matched `TableSkeleton`/`StatCardsSkeleton`
rather than being left on the old pattern.

**WhatsApp Campaign Manager pages exercise the full lifecycle built in
the previous module.** The list page (`/admin/whatsapp`) is campaign
history with a minimal creation form (name + existing template). The
detail page (`/admin/whatsapp/[id]`) conditionally renders each
lifecycle action based on the campaign's actual status — audience
resolution (filter/manual/CSV tabs) only while `"draft"`, Send Now/
Schedule only while `"ready"`, Cancel while
`"ready"|"scheduled"|"sending"`, Retry Failed whenever there's a failed
count — mirroring the exact status-gating already enforced server-side
in `whatsappCampaignService`, so the UI never offers an action the API
would reject.

**Accessibility fix caught during the pass, not left in.** The
audience-source tab control was first built with `role="tablist"`/
`role="tab"`/`aria-selected` — the ARIA Authoring Practices tab pattern,
which requires arrow-key navigation between tabs. Since these are plain
click-to-switch buttons with no arrow-key handling, that would have been
a real keyboard-accessibility mismatch (announced as a tab widget,
behaving like a button group). Fixed to `role="group"` +
`aria-pressed`, which correctly describes a toggle-button group and
needs no extra keyboard wiring.

**Sidebar grown from 6 items to 12** (the 11 requested pages, plus the
pre-existing Attendance page, which was never asked to be removed) —
made `sticky`/`h-screen`/`overflow-y-auto` so it scrolls independently
once the nav no longer fits a short viewport, rather than growing the
whole page. Every new nav icon (`MessageCircle`, `Workflow`, `FileText`,
`Contact`, `Settings`, `ScrollText`) confirmed to exist in the installed
`lucide-react` version before use.

**Live-verified end to end**, not just type-checked. With MongoDB
unconfigured (in-memory repositories), a production server was started
with a fixed `JWT_ACCESS_TOKEN_SECRET` and an admin-role JWT minted to
match it (the same technique this session has used throughout, since
there is no way to seed a real user into a separately-running server
process otherwise): every new `GET` endpoint returned real data
(`/api/admin/settings`, `/api/admin/automation/definitions`,
`/api/admin/automation/runs`, `/api/admin/audit-logs`,
`/api/admin/whatsapp-campaigns`, `.../templates`), and a full
create-template → create-campaign round trip succeeded against the
running server. `tsc --noEmit`, `npm run lint` (steady at the
pre-existing 68-problem/17-error/51-warning baseline throughout — zero
new issues introduced by any file in this module), and `npm run build`
all verified clean, with the full 11-page route list (plus
`/admin/whatsapp/[id]` and every new `/api/admin/...` route) confirmed
in the build output and the old `/admin/marketing` route confirmed
gone. No marketing-site file was touched.

---

## WhatsApp Campaign Manager (audit-then-build, "Campaign Architecture")

**Goal:** production-ready WhatsApp bulk campaign management — creation,
audience selection (existing Lead filters, CSV import, manual lists),
scheduling, immediate send, a shared job queue, retry with a fixed
policy, delivery/read/failed analytics, and campaign history — built on
top of the existing WhatsApp Cloud API module and, per the approved
architecture, sharing ONE scheduling infrastructure with the Automation
Engine rather than a second independent poller. Preceded by two
audit-and-design-only turns (`WHATSAPP_ARCHITECTURE.md`,
`CAMPAIGN_ARCHITECTURE.md`) with explicit approval before any code was
written — both documents' status headers are now updated to reflect
what was actually built.

**Separate bounded context, on purpose (approved decision 5).** The
existing `Campaign` entity (`lib/services/campaigns`) is marketing
attribution — UTM/channel/budget — and has nothing to do with "send
this message to these 500 people." The new `WhatsAppCampaign` entity
is deliberately independent, with `whatsappCampaignService` as its own
export (no rename of the pre-existing `campaignService`). The only
connection is an optional `marketingCampaignId` cross-reference for
attribution reporting.

**The shared scheduler (approved decision 3) needed a real contract, not
just a shared table.** A single fixed retry policy applied to every job
type would have forced the Automation Engine's existing, working
per-step retry semantics (different `maxAttempts`/backoff *within the
same workflow run*, depending on which step is executing) into
something they don't fit. The fix: `JobOutcome` — `"completed"`,
`"reschedule"` (a job manages its own timing entirely; never consumes
the generic `attempts` counter), or `"failed"` (only this path consults
the job's own optional `retryPolicy`). The Automation Engine's
integration is a single new file, `schedulerIntegration.ts`, that wraps
its **completely unmodified** `runDueWorkflowSteps()` as a
self-rescheduling "tick" — zero lines changed in `engine.ts`,
`triggers.ts`, `types.ts`, or any workflow definition. The WhatsApp
campaign message-send job type is the one that actually uses the
generic retry machinery, with the approved policy (decision 4): 3
attempts, backoff at 1/5/15 minutes, then permanently failed.

**`MessageAttempt` added per your explicit ask** — `Message` is current
delivery state (one row per recipient per campaign, doubling as the
queue unit and the "Retry Failed" unit); `MessageAttempt` is an
immutable log, one row per actual send attempt, with the vendor error
code/message captured for diagnostics. Verified live: a real failed
attempt (invalid Meta token) followed by a successful retry produces
exactly two `MessageAttempt` rows in the correct order.

**A genuine test-caught, code-corrected finding.** Live-testing retry
behavior with an intentionally invalid Meta access token (the same
technique used when the Meta Cloud API adapter was first built) showed
the message marked permanently failed after **1** attempt, not 3. This
is *correct*: an invalid token is a `401`, which the Meta adapter
already classifies as non-retryable (the same "retrying won't fix a
malformed request" reasoning it already applies to other `4xx`
errors) — retrying with the same bad token two more times would be
pure waste. The test's assumption was wrong, not the handler; the test
was corrected, the code was not.

**Cancelling a "sending" campaign was fixed properly, not documented as
a gap.** The first draft of the cancel route's own doc comment
described in-flight message jobs as not checking a cancelled campaign's
status. Reconsidered before finishing: `handleSendMessage` now checks
the owning campaign's status before attempting a send and skips itself
(marks the job `"completed"`, sends nothing, no counters touched) once
the campaign is `"cancelled"` — a small, cheap addition (one repository
read per message job) that closes a real correctness gap instead of
accepting it.

**CSV import (approved decisions 1 and 2): Papa Parse, capped at 5,000
rows, designed for future streaming.** `csvImportService.ts` is a pure,
per-row `validateRow`-shaped function deliberately independent of *how*
rows are fed to it — today that's Papa Parse's default in-memory `data`
array (fine at 5,000 rows), and a future larger-dataset version would
swap in Papa Parse's own `step` callback (streaming, one row at a time)
without the validation logic itself changing. Phone validation reuses
the existing India-specific `normalizeIndianMobile`/`isValidIndianMobile`
(the only phone validator anywhere in this codebase) rather than adding
a new international one — a scoped decision, not an oversight.

**A real, necessary extension to shared HTTP infrastructure.**
`withApiRoute()` only ever supported flat routes before this module —
every existing route handler is called with a single `request`
argument. This module is the first to need resource-scoped routes
(`/api/admin/whatsapp-campaigns/[id]/...`), so `ApiRouteContext` gained
a `params: Record<string, string>` field and the wrapper now forwards
Next.js's dynamic-segment argument. Fully backward compatible — every
pre-existing route handler ignores the new field and needed no changes
(confirmed by a clean `tsc` immediately after the change, before any
new route existed to exercise it).

**Template variable filling is deliberately limited, not a bug.** A
campaign message fills every one of its template's variable slots with
the recipient's name (the only per-recipient dynamic field available
across all three audience sources) — a template needing richer
per-recipient data (e.g. a program name) isn't supported yet. Flagged
below, not silently worked around.

### Files created

**Shared scheduler (`lib/services/scheduler/`):**

| File | Why |
|---|---|
| `types.ts` | `ScheduledJob`, `JobOutcome`, `JobHandler`, `SchedulerRetryPolicy` — the contract described above |
| `registry.ts` | `registerJobHandler`/`getJobHandler` — dependency inversion, same shape as the WhatsApp provider registry |
| `bootstrap.ts` | Self-bootstrapping handler registration — same fix, same reason, as `lib/events/eventBus.ts`'s `ensureBootstrapped()` (Next.js splits module graphs; registration must happen from inside the module that owns the shared state) |
| `schedulerService.ts` | `enqueueJob()`, `runDueScheduledJobs()` — the one poller, bounded batch size |
| `lib/db/models/scheduledJob.model.ts` + `scheduledJob.{mongodb,inMemory}.repository.ts` | Standard dual-repository pattern; indexed on `{status, runAt}` (the poller's own query) and `{jobType}` |

**Automation Engine bridge (additive only):**

| File | Why |
|---|---|
| `lib/services/automation/schedulerIntegration.ts` | Wraps the existing `runDueWorkflowSteps()` as a self-rescheduling job — no other automation file touched |
| `lib/services/automation/index.ts` | Two new exports added (`registerAutomationTickHandler`, `ensureAutomationTickScheduled`) — nothing existing changed |

**WhatsApp Campaign Manager (`lib/services/whatsappCampaigns/`):**

| File | Why |
|---|---|
| `types.ts` | `WhatsAppCampaign`, `CampaignTemplate`, `Message`, `MessageAttempt` + repository interfaces — see CAMPAIGN_ARCHITECTURE.md §3 for the full schema/index reasoning |
| `validation.ts` | Create-campaign / create-template input validation |
| `csvImportService.ts` | Described above |
| `whatsappCampaignService.ts` | Campaign lifecycle, audience resolution (filter/manual/CSV), send/schedule/cancel/retry, analytics |
| `jobTypes.ts` | The two job-type string constants, in their own file so `whatsappCampaignService.ts` and `jobHandlers.ts` don't need to import each other just for them |
| `jobHandlers.ts` | Bridges onto the shared scheduler — `send_message` (calls the existing `processSendJob()`, zero new sending logic) and `promote_scheduled` |
| `index.ts` | Public barrel |
| `lib/db/models/{whatsappCampaign,campaignTemplate,message,messageAttempt}.model.ts` + matching `*.mongodb.repository.ts`/`*.inMemory.repository.ts` pairs | Standard dual-repository pattern for all four entities |
| `config/whatsappCampaigns.ts` | `CSV_IMPORT_MAX_ROWS` (5,000), `MESSAGE_RETRY_POLICY` (3 attempts, 1/5/15 min) — the two approved constants |

**Routes** (all `requiredRole: "admin"`, all built on `withApiRoute`):

| File | Route |
|---|---|
| `app/api/admin/whatsapp-campaigns/route.ts` | `POST` create, `GET` list (Campaign History) |
| `.../templates/route.ts` | `POST`/`GET` — Campaign Templates |
| `.../[id]/route.ts` | `GET` — detail + live analytics |
| `.../[id]/audience/route.ts` | `POST` — resolve audience (filter/manual, JSON) |
| `.../[id]/import/route.ts` | `POST` — CSV import (the one non-JSON route, `multipart/form-data`) |
| `.../[id]/send/route.ts`, `.../schedule/route.ts`, `.../cancel/route.ts`, `.../retry-failed/route.ts` | The lifecycle actions |
| `.../[id]/messages/route.ts` | Per-recipient diagnostics, paginated |
| `app/api/admin/scheduler/run-due-jobs/route.ts` | Manual poller trigger — the wiring point a future cron would call |

No UI — per your instructions, backend-ready APIs and services only.

### Files modified

| File | Change |
|---|---|
| `lib/api/withApiRoute.ts` | `ApiRouteContext` gained `params`; the wrapper forwards Next.js's dynamic-route-segment argument — described above, fully backward compatible |
| `lib/services/auditLog/types.ts` | `AuditContext` gained optional `actorId` — every campaign-manager route is `requiredRole: "admin"`, so (unlike Lead/Campaign/Registration's originally-public routes) the acting user is always known |
| `lib/services/auditLog/actions.ts` | Four new business-audit actions: campaign created/send-started/scheduled/retry-requested. Individual message send/deliver/read/fail events stay operational-log-only (same high-frequency-is-not-audit-worthy judgment already applied to token refresh) |
| `lib/db/repositories/types.ts` | `AuditEntityType` gained `"WhatsAppCampaign"` |
| `lib/db/registry.ts`, `lib/db/index.ts` | Five new repository getters (`ScheduledJob`, `WhatsAppCampaign`, `CampaignTemplate`, `Message`, `MessageAttempt`) |
| `app/api/webhooks/whatsapp/route.ts` | POST handler gained `applyStatusEvent()` — looks up a `Message` by `providerMessageId` and updates its status/timestamp + the owning campaign's rollup counters, instead of only logging the event. Signature verification/parsing untouched. `sentCount` is deliberately never incremented here (already incremented by the send-job handler; doing it again would double-count) |
| `package.json` | New deps: `papaparse`, `@types/papaparse` (not bundled by the package itself, unlike `bcryptjs`) |

**No existing UI file was touched** — confirmed via `git status` against the same frozen baseline tracked every module since Module 2.

### Live verification (not just build-time)
- `tsc --noEmit` clean throughout (including immediately after the `withApiRoute` extension, before any route existed to exercise it); `npm run lint` unchanged at the 68/17/51 baseline; `npm run build` clean, 57 routes (up from 54), all 10 new campaign-manager routes plus the scheduler route present as dynamic (`ƒ`).
- **Shared scheduler, in isolation**: a `"reschedule"`-type job (the Automation Engine's own pattern) correctly re-arms itself without touching `attempts`; a retryable failure's backoff timing verified by direct repository inspection (not a real wall-clock wait) — not due within 30 seconds, due once ≥1 minute (the first backoff step) has passed; full 3-attempt exhaustion (fast synthetic policy) correctly invokes a handler exactly 3 times before the job stops being due.
- **Full campaign lifecycle, real data, console provider**: CSV parsing (3 valid/unique recipients from 5 rows, correctly rejecting an invalid phone and a duplicate, correctly detecting a missing phone column); campaign creation rejects an unknown `templateId`; manual-audience dedup; `draft → ready → sending → completed` all confirmed; denormalized rollup counters match a live `Message` aggregation exactly; `MessageAttempt` history recorded correctly.
- **Real failure against Meta** (intentionally invalid access token, live HTTP call): correctly classified non-retryable, correctly failed after 1 attempt (see the test-caught finding above), correctly rolled up into `failedCount`, campaign correctly auto-completed.
- **Retry Failed**: resets a failed message, campaign resurrected from `"completed"` back to `"sending"`, succeeds via the console provider on retry, `MessageAttempt` history shows both the original failure and the successful retry in order.
- **Shared infrastructure, proven together, not just asserted**: a real `lead.created` event (Automation Engine, completely unmodified) and a real WhatsApp campaign send both sit in the *same* `ScheduledJob` queue at the same time; one `runDueScheduledJobs()` call correctly drains the campaign's job.
- **Full live HTTP walkthrough** (real running server, minted admin JWT — MongoDB isn't configured in this environment, same constraint noted in every prior module needing a seeded session): `401` with no cookie confirmed on the new routes; template → campaign → CSV import via real `multipart/form-data` (2 valid contacts, 1 rejected) → send → manual scheduler trigger (processed 3 jobs: 2 messages + 1 automation tick, correctly interleaved) → analytics showing `completed`/`sentCount: 2` → messages list showing both with real `providerMessageId`s.
- **Webhook persistence**: a real HMAC-SHA256-signed Meta-shaped payload, verified via the real (unmodified) Meta adapter's signature check, referencing a real console-sent message's `providerMessageId` — correctly looked up, correctly advanced the Message to `"delivered"`, correctly incremented the campaign's `deliveredCount`. (Verified against the real adapter and real repositories directly rather than through one single HTTP call, since the "active provider" is one fixed choice per process — sending via console and parsing via the Meta adapter in the same live-server request isn't possible without real Meta credentials; each real piece was still verified, just not literally in one request. Documented here rather than silently glossed over.)

### Future considerations
- Template variable filling (recipient name only) — see above; a template needing richer per-recipient data isn't supported yet.
- No scheduler is actually wired to call `runDueScheduledJobs()` automatically — the same gap already flagged for the pre-existing `runDueWorkflowSteps()`/`pruneExpiredAuditLogs()`, now serving three consumers instead of one. `app/api/admin/scheduler/run-due-jobs` is the wiring point for whenever a Vercel Cron (or equivalent) is set up.
- Audience filtering targets Leads only (the entity with an actual phone number) — Registration-based targeting ("everyone registered for Program X") would need a join and is out of scope for this pass.
- No `MessageAttempt`-history route was added (no UI needs it yet) — the data exists and is queryable directly via `getMessageAttemptRepository()` for a future addition.
- CSV import is capped at 5,000 rows in-memory; the streaming migration path is designed for (see csvImportService.ts's own doc comment) but not built, since nothing currently needs it.

---

## CRM Dashboard UI (requested as "Module 11")

**Goal:** the actual frontend for everything Modules 7–9 built — a
sidebar-driven admin dashboard at `/admin` with a login flow, Overview
(registration/UTM/student-status analytics), Leads, Campaigns,
Registrations, Attendance (list + mark), and Marketing (funnels + ad
metrics + per-campaign breakdown). The first module this session where
building UI was the actual point, not a constraint to work around.

**Middleware now protects pages, not just APIs.** `middleware.ts`'s
matcher gained `/admin/:path*`. An unauthenticated request now gets one
of two different responses depending on what it asked for — unchanged
JSON `401` for `/api/*` (a `fetch()` caller expects a parseable body,
not a redirect), and a `307` to `/admin/login?from=<path>` for a
dashboard *page* (a browser navigating to a protected page should land
on a sign-in form). `/admin/login` itself is exempt from the check and
instead redirects *away* to `/admin` if a valid session already exists.
Role is deliberately not checked at the middleware/page level — every
dashboard page still calls the real `/api/admin/*` endpoints, which
already enforce `requiredRole: "admin"`, and a `403` from those renders
as "you don't have permission" in the UI rather than being duplicated
as a second, separate authorization check here.

**No charting library.** Module 10 just spent real effort removing
unused heavy dependencies (`gsap`, `@splinetool/*`); adding a full chart
library for a handful of funnel/metric numbers would cut directly
against that. Funnels render as a plain stage → stage strip with a
computed rate; the Marketing page's account-wide metrics are stat
cards — both plain React/Tailwind, zero new dependencies.

**A real, two-round lint fix, not papered over.** The shared
`useAdminData` hook's first version called `setLoading(true)`
synchronously at the top of its effect body —
`react-hooks/set-state-in-effect` correctly flagged this (2 new errors
over the 68/17/51 baseline). The first fix (deriving `loading` by
reading a ref's `.current` during render) traded that violation for a
different one — a newer React 19 rule against reading refs during
render, since ref reads aren't guaranteed current under concurrent
rendering. The actual fix: React's own documented pattern for "reset
state when a dependency changes" — a conditional `setState` call in the
render body itself (not in an effect, not from a ref), which React
special-cases to re-render immediately with no extra visible frame.
Lint returned to exactly 68/17/51 only after this second attempt.

**Every metric's "unavailable vs. zero" distinction, built in Modules 8
and 9, was verified to survive all the way to the rendered page** — not
just assumed to, because the service layer already got it right. Live:
Lead Funnel's visitor count renders as an em dash with an explanatory
note (no web analytics provider connected) sitting right next to a real
`0` for leads (genuinely zero, not unavailable) in the same funnel
strip. Same for Revenue Funnel (no Payments module) and account-wide
CTR/CPC/CPA/ROAS (no ad provider) — each format helper
(`components/admin/format.ts`) renders `null` as "—", never "0".

**Mark Attendance has no registration picker** — a plain text field for
`registrationId` with a clear placeholder, not a searchable lookup
against the Registrations list. That needs infrastructure (a
type-ahead search endpoint) this build doesn't have; a real gap for a
follow-up, not something quietly worked around.

### Files created

**Route protection:**

| File | Change |
|---|---|
| `middleware.ts` | Matcher extended to `/admin/:path*`; page-vs-API branching, login-page bypass/redirect-away, described above |
| `components/SiteChrome.tsx` | `/admin/*` renders bare children — the dashboard has its own shell, not the marketing site's Navbar/Footer/WhatsApp bubble/lead popup/cursor effects |

**Browser-side data layer:**

| File | Why |
|---|---|
| `components/admin/apiClient.ts` | Typed fetch wrappers for every auth + admin endpoint. Single-flight refresh-on-401 + retry-once (the access token is short-lived by design — Module 9 — so this is the normal case for anyone who keeps a tab open, not an edge case); hard-redirects to `/admin/login` only once refresh *also* fails. A `403` is never treated this way — returned to the caller as a normal failure so a page can render "you don't have permission," not get yanked away |
| `components/admin/AdminAuthContext.tsx` | `useAdminAuth()` — identity/role for the header and for explaining a 403, not a gate (middleware already guarantees a valid session before any dashboard page renders) |
| `components/admin/useAdminData.ts` | Shared loading/error/forbidden lifecycle — see the lint note above for why `loading` is derived, not set imperatively |

**Shared UI primitives:**

| File | Why |
|---|---|
| `components/admin/{StatCard,Badge,Table,Pagination,DataStates,FilterControls,FormField,format}.ts(x)` | `Table` alone is reused 6+ times (Overview's two breakdowns, Leads, Campaigns, Registrations, Attendance, Marketing's campaign table) — the threshold that justifies a shared component over repeating the markup. `FilterControls` (aria-label only) is deliberately separate from `FormField` (a real visible `<label>`) — a compact filter chip and an actual data-entry field (Mark Attendance) have different accessibility needs, matching the distinction Module 10's audit established |
| `components/admin/useDebouncedValue.ts` | Search fields don't fetch on every keystroke |
| `components/admin/Sidebar.tsx`, `DashboardHeader.tsx` | Nav + current-user/logout — the dashboard's own shell |

**Pages:**

| File | Route |
|---|---|
| `app/admin/login/page.tsx` | `/admin/login` — no shell, no AdminAuthProvider; reads `?from=` to return to the originally-requested page, validated against `/admin` prefix (open-redirect prevention) |
| `app/admin/(dashboard)/layout.tsx` | The shell — `(dashboard)` is a route group, doesn't appear in the URL. Shows a role notice for any non-Admin role, since every current API route requires Admin specifically |
| `app/admin/(dashboard)/page.tsx` | `/admin` — Overview: registration analytics, UTM breakdown, student status |
| `app/admin/(dashboard)/leads/page.tsx` | `/admin/leads` — search/status/source/program filters, pagination, CSV export |
| `app/admin/(dashboard)/campaigns/page.tsx` | `/admin/campaigns` — status/channel/search filters, pagination, CSV export |
| `app/admin/(dashboard)/registrations/page.tsx` | `/admin/registrations` — status/programSlug/campaignId filters, pagination, CSV export |
| `app/admin/(dashboard)/attendance/page.tsx` | `/admin/attendance` — list + filters + Mark Attendance form, CSV export |
| `app/admin/(dashboard)/marketing/page.tsx` | `/admin/marketing` — funnels, account-wide CTR/CPC/CPA/ROAS, per-campaign breakdown, date range |

**No existing marketing-site UI file was touched** beyond `SiteChrome.tsx`'s one necessary addition — confirmed via `git status` against the same frozen baseline tracked every module since Module 2.

### Live verification (not just build-time)
- `tsc --noEmit` clean; `npm run lint` back to the exact 68/17/51 baseline (after the two-round fix above); `npm run build` clean, 54 routes (up from 47), all 6 new `/admin/*` page routes present.
- **Middleware, over real HTTP**: `GET /admin` with no cookie → `307` to `/admin/login?from=%2Fadmin`; `GET /admin/leads` → `307` to `...?from=%2Fadmin%2Fleads`; `GET /admin/login` itself → `200`, unaffected; `GET /api/admin/leads` → unchanged JSON `401` (proving the API-vs-page branch works correctly).
- **In a real browser**: since MongoDB isn't configured in this environment, there's no way to seed a real user into the *running server's* in-memory store from outside it (the same constraint documented in the Authentication module) — and this module's attempted workaround (injecting a signed session cookie via the page's own JS) was correctly blocked by the browser tool's safety policy against writing auth/cookie-shaped data, which was respected rather than routed around. Verified instead: the login form's real negative path (wrong credentials → "Invalid email or password.", exactly the Authentication module's own generic, enumeration-safe message, rendered live); and, using the same shared-secret-minted-JWT technique the Authentication module used for its own middleware tests, a full authenticated walkthrough — Overview, Leads, and Marketing pages screenshotted rendering real API data with correct empty/unavailable states, zero console errors, Log Out correctly clearing the session (confirmed by immediately being redirected back to `/admin/login?from=%2Fadmin` on the next request).
- Regression: existing marketing-site pages unaffected by the `SiteChrome.tsx` change.

### Future considerations
- No registration picker for Mark Attendance (see above) — needs a type-ahead search endpoint against Registrations.
- No URL-synced filter/page state (a page's filters reset on navigation away and back) — a nice-to-have, not built for this pass.
- The role notice in the dashboard shell is the only UI acknowledgment that Manager/Counsellor exist; no route in this dashboard (or the API it calls) is scoped to them yet — same open item flagged in the Authentication module's own changelog entry.
- Full authenticated-flow browser verification used a synthetically-minted session rather than a real login, for the environment reason described above — revisit with a real seeded user once MongoDB is configured.

---

## Performance Optimization (requested as "Module 10")

**Goal:** audit Bundle Size, Image Optimization, Code Splitting, Dynamic
Imports, Caching, ISR, Metadata, Fonts, Lighthouse, Accessibility, and
SEO — then fix what's actionable without redesigning the UI. Full
findings (including "already good, no action needed" conclusions) are
in the new `PERFORMANCE_AUDIT.md`; this entry is the file list and
verification.

**Measured with a real Lighthouse run**, not simulated — `npx
lighthouse` with headless Chrome against a genuine `next build && next
start` server, before and after this module's changes:

| Category | Before | After |
|---|---|---|
| Performance | 78 | 82 |
| Accessibility | 94 | 96 |
| Best Practices | 96 | 96 |
| SEO | 100 | 100 |

**"Do not redesign UI" was interpreted literally, not as "touch
nothing."** Every fix in this module is either invisible (an
`aria-label`, a `dangerouslySetInnerHTML` JSON-LD script, a response
header, a dynamic-import mechanism) or a semantic HTML tag swap with the
*exact same CSS classes* (an `h4` that skipped a heading level becomes
`h3`; a duplicate `h1` becomes `h2`) — verified pixel-identical via live
screenshots, not assumed. The one exception is a single color value
(`text-slate-400` → `text-slate-500` on one component's "trusted by"
marquee) — a contrast fix computed against the real WCAG formula, not
guessed, and scoped to that one component rather than a sitewide
find-replace.

**Two real, pre-existing bugs found by actually running Lighthouse,
not by guessing.** (1) A first Lighthouse pass flagged specific DOM
nodes for insufficient contrast and invalid heading order; fixing the
flagged nodes and re-running Lighthouse showed the heading-order
violation *still present* — which led to the real cause: `app/page.tsx`
had **two `<h1>` elements** (the correct one in `HeroSection.tsx`, and a
second, larger one buried in the closing CTA section). An earlier
"exactly one h1" check had only grepped `app/page.tsx` directly and
missed the one contributed by an imported component — a real gap in
the audit's own first-pass method, corrected before concluding anything
was clean. (2) The same Lighthouse run surfaced 7 console errors: broken
image/video references (`/students/1.jpg`...`5.jpg`, `/student.jpg`,
`/videos/testimonial.mp4`) in `HeroSection.tsx`, predating this module.
**Not fixed** — no real photos/video exist to point them at, and
removing the avatar stack or video player outright is a visible
structural change, not a markup correction. Flagged in
`PERFORMANCE_AUDIT.md` §10 for an explicit content decision instead of
silently deciding either way.

**Method note, since a few conclusions in this module contradicted an
earlier pass in the very same session:** the initial "no raw `<img>`
tags" and "every `<Image>` has `alt`" checks used `grep "<img "`
(trailing space) and a naive regex — both had real blind spots on
multi-line JSX (`<img\n  src=...`) that a second, more careful pass
caught. Both blind spots are documented in `PERFORMANCE_AUDIT.md` rather
than silently patched over, since the same class of miss could recur
elsewhere.

### Files created

| File | Why |
|---|---|
| `PERFORMANCE_AUDIT.md` | The audit itself — all 11 categories, what was fixed, what was deliberately left alone and why |
| `config/site.ts` | `SITE_URL` — single source of truth, replacing a URL previously hardcoded independently in `app/bootcamp/page.tsx`'s JSON-LD |
| `app/robots.ts`, `app/sitemap.ts` | Neither existed before. Next's file-convention (served at `/robots.txt`, `/sitemap.xml`, no route handler) — sitemap generated from the same `lib/blog-posts.ts` data `generateStaticParams()` already uses, so a new post appears in both automatically |

### Files modified

| File | Change |
|---|---|
| `package.json` | Removed `gsap` and `@splinetool/react-spline`/`runtime` — confirmed zero imports anywhere (ruled out a `keySplines` SVG-attribute false positive); `node_modules` 545 MB → 531 MB |
| `components/ui/spline-scene.tsx` | Deleted — the only importer of `@splinetool`, itself never imported by anything |
| `components/lead-modal/LeadModalProvider.tsx` | `LeadModal` now `next/dynamic(..., { ssr: false })` — code-splits the modal (+`LeadForm`+`SuccessScreen`) out of every page's bundle; verified live (opens and functions identically) |
| `components/ai-bootcamp/LandingPage.tsx`, `components/ai-generalist/LandingPage.tsx` | Same for `RegistrationModal`/`SuccessModal`, via plain `dynamic()` (no `ssr: false` — disallowed in these Server Components) |
| `components/lead-modal/LeadForm.tsx`, `components/ai-bootcamp/RegistrationModal.tsx`, `components/ai-generalist/RegistrationModal.tsx` | Added `aria-label` to every input/select that relied on `placeholder` alone — isolated to these three; `RegisterForm`/`ContactForm`/`InternshipApplyForm` already used proper `<label htmlFor>` |
| `app/layout.tsx` | Skip-to-content link (WCAG 2.4.1, invisible until keyboard-focused); `metadataBase`; `openGraph.images`/`twitter` card (existing `logo2.png` asset — not a purpose-built OG card, see audit doc); explicit `robots`; site-wide `EducationalOrganization` JSON-LD |
| `components/SiteChrome.tsx` | `id="main-content"` on all 3 `<main>` branches — the skip link's target |
| `next.config.ts` | `images.formats: ["image/avif","image/webp"]`; `poweredByHeader: false`; `Cache-Control` header for `/public` image assets (1 day, not Next's 1-year immutable policy for hashed `/_next/static` — these aren't content-hashed) |
| `lib/api/response.ts` | `apiSuccess()` gained an optional `headers` param, mirroring `apiError()`'s existing one |
| `app/api/campaigns/route.ts` | `GET` now sends `Cache-Control: public, max-age=30, stale-while-revalidate=120` |
| `components/LogoMarquee.tsx` | `text-slate-400` → `text-slate-500` (2.63:1 → 4.76:1 against white; computed via the WCAG relative-luminance formula) |
| `components/TestimonialCard.tsx`, `components/TestimonialCard2.tsx`, `components/Footer.tsx` | `h4` → `h3` (skipped a heading level under their section's `h2`) — same classes, no visual change |
| `app/page.tsx` | Second `<h1>` (closing CTA) → `<h2>` — see the two-bugs note above |
| `app/bootcamp/page.tsx` | JSON-LD `sameAs` now reads from `config/site.ts` instead of a hardcoded literal |

**UI files touched, and why this doesn't violate "do not redesign UI":**
every change above is either invisible (aria-label, JSON-LD, headers,
dynamic-import mechanics, an `id` attribute) or a same-class tag swap —
see the interpretation note above and the live-screenshot verification
below. No layout, spacing, color (beyond the one documented contrast
fix), or copy changed.

### Live verification (not just build-time)
- `tsc --noEmit` clean; `npm run lint` unchanged at the 68/17/51 baseline; `npm run build` clean, 47 routes (was 45), including new `/robots.txt` and `/sitemap.xml` static routes.
- Real Lighthouse run, before and after (table above) — every fix re-verified by confirming the specific previously-flagged node no longer appears, not assumed.
- `/api/campaigns` `GET` confirmed sending the new `Cache-Control` header live; a `/public` image asset confirmed sending the new day-long cache header; `X-Powered-By` confirmed absent.
- `/robots.txt` and `/sitemap.xml` fetched live and confirmed correct content (real URLs, real blog slugs).
- Regression: `/about`, `/pricing`, `/programs`, `/blog`, `/ai-bootcamp`, `/ai-generalist`, `/bootcamp` all still `200`.
- **Visual, via a real browser** (not just HTTP status): homepage and `/ai-bootcamp` screenshotted before and after opening their now-dynamically-imported modals — both open, render, and function identically to before; footer headings (`h4`→`h3`) confirmed pixel-identical; zero console errors triggered by either modal. This is the actual evidence behind "no redesign," not just a code-review claim.
- `git status` confirms every newly-touched file matches the plan above — no accidental changes.

### Future considerations
- The two Lighthouse findings left unfixed (broken placeholder assets in `HeroSection.tsx`; the global `--ls-muted` token's marginal 4.44:1 contrast) need an explicit decision — real content for the former, a conscious sitewide color change for the latter — not something to silently resolve either way.
- `openGraph`/`twitter` images use the existing `logo2.png` brand asset, not a purpose-built 1200×630 social card with a tagline — a real design upgrade, not a code fix.
- ISR was evaluated and found not applicable to any current page (see `PERFORMANCE_AUDIT.md` §6) — revisit only if blog content moves off the in-repo `lib/blog-posts.ts` array to a CMS/database.
- Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts` (flagged already in the Authentication module's entry) — still unmigrated for the same reason as before.

---

## Authentication (requested as "Module 9")

**Goal:** JWT access tokens, refresh tokens, role-based access (Admin/
Manager/Counsellor), secure cookies, middleware, protected routes —
turning every route this project built with `requiredRole` into
something genuinely reachable for the first time.

**The defining design decision: access tokens are JWTs, refresh tokens
are not.** A refresh token has to be revocable per-session regardless of
how it's encoded — encoding it as a JWT (with a `tokenVersion` claim,
its own secret, its own expiry bookkeeping) would add complexity without
removing the server-side state it still needs. So the refresh token is
an opaque, cryptographically random string; only its SHA-256 hash is
ever persisted (`RefreshTokenRecord`), and it's rotated on every use
**with reuse detection**: presenting an already-rotated token — the
standard signal it was copied — revokes the entire token family, not
just that one record. This is the OWASP-recommended pattern. Verified
directly: rotation issues a new token pair, replaying the old one fails
with `reason: "reused"`, and a second still-unused-looking token from
the same family is also dead afterward.

**Middleware does the one authentication step; withApiRoute does
authorization.** `middleware.ts` verifies the access-token cookie's JWT
(via `jose` — Web Crypto, not `node:crypto`, because this runs on the
Edge runtime) and, only if valid, injects trusted `x-auth-user-id`/
`x-auth-email`/`x-auth-role` request headers — stripping any
client-supplied copies first, so a client can never spoof `x-auth-role:
admin` by just sending the header. `lib/api/roles.ts`'s
`getAuthContext()` now only ever reads those headers; it doesn't parse
cookies or verify anything itself. If a route's path isn't in
middleware's matcher, no headers get set and `getAuthContext()` returns
an empty context — the exact same fail-closed default this file has had
all along, now backed by a real mechanism instead of an always-empty
stub. `withApiRoute.ts`'s existing `requiredRole` gate is unchanged in
shape, but now does real work, and now distinguishes **401** (no valid
session at all — `UnauthorizedApiError`) from **403** (valid session,
insufficient role — `ForbiddenApiError`), a distinction that didn't
mean anything before real sessions existed.

**Existing admin routes were left at `requiredRole: "admin"`,
deliberately not re-scoped to "manager"/"counsellor."** The three-tier
hierarchy is fully real and independently verified (rank-based:
Counsellor < Manager < Admin, `admin` satisfies everything, `manager`
satisfies manager/counsellor but not admin, and so on — all nine
combinations tested directly), but deciding which of the six existing
`/api/admin/*` routes a Manager or Counsellor should be allowed to see
(bulk PII? revenue figures?) is a product decision this module wasn't
asked to make and didn't have the context to make safely. Flagged here
rather than silently resolved either way.

**This is the trigger `AUDIT_ARCHITECTURE.md`'s approved decision 3
explicitly deferred to** — "revisit rejected/failed requests once
authentication/authorization exist." They now do, and
`category: "security"` (planned, zero producers since that module)
finally has one: `lib/services/auditLog/securityAuditLogService.ts`, a
deliberately separate module from `auditLogService` (see that file's own
doc comment, written before this one existed, anticipating exactly this
split — never a `category` parameter bolted onto the business-event
writer). Login success/failure, logout, refresh-token-reuse detection,
and role-gate rejections are all audited; a routine successful token
refresh is not (bookended by the login/logout that already mark the
session's edges — auditing every ~15-minute refresh would be one row
per active session per refresh, routine-and-expected in exactly the
sense AUDIT_ARCHITECTURE.md's decision 1 already excluded
`lead.duplicate_touched` for).

**A JWT secret has no safe no-op**, unlike every other optional
credential in this codebase. WhatsApp/Marketing config all fall back to
a working no-op provider when unset; a hardcoded fallback JWT secret
would instead be a real vulnerability if a deployment ever forgot to set
one. `config/auth.ts` generates a random secret per process start
instead, logged loudly — the app still never fails to build or start,
but tokens won't verify across restarts/instances until a real secret is
configured, which is the correct forcing function for production rather
than a silent, exploitable default.

**A real, non-obvious bug caught by live testing, not by `tsc`.**
`middleware.ts` originally imported `verifyAccessToken` from the
`lib/services/auth` barrel — which also re-exports `authService`, which
pulls in `lib/db/registry.ts` (every entity's in-memory repository,
several using `node:crypto`). Turbopack's build caught it immediately:
*"A Node.js module is loaded ('crypto') which is not supported in the
Edge Runtime."* Fixed by importing `verifyAccessToken` directly from
`./tokens` (jose-only, genuinely edge-safe), the one deliberate exception
to this module's own "only import via the barrel" convention — documented
in both files.

### Files created

**Config:**

| File | Why |
|---|---|
| `config/auth.ts` | JWT secret (random-per-process fallback, see above), access/refresh TTLs, cookie names/path, `AUTH_COOKIE_SECURE` (defaults to production-only) |

**New entities (User, RefreshToken) — types live in this module's own service directory, same precedent as Attendance:**

| File | Why |
|---|---|
| `lib/services/auth/types.ts` | `User`/`PublicUser` (passwordHash never leaves this layer), `UserRole` (counsellor/manager/admin), `RefreshTokenRecord` (tokenHash + familyId), repository interfaces |
| `lib/db/models/user.model.ts`, `refreshToken.model.ts` | Mongoose schemas; RefreshToken has a TTL index (cleanup) plus explicit `expiresAt`/`revokedAt` checks in authService (the TTL index is garbage collection, not the authorization check itself) |
| `lib/db/repositories/{user,refreshToken}.{mongodb,inMemory}.repository.ts` | Standard dual-repository pattern |

**Auth service:**

| File | Why |
|---|---|
| `lib/services/auth/password.ts` | bcryptjs hash/verify, cost factor 12 |
| `lib/services/auth/tokens.ts` | `signAccessToken`/`verifyAccessToken` — jose only, edge-safe (imported directly by middleware.ts) |
| `lib/services/auth/refreshTokenCrypto.ts` | Refresh-token generation/hashing — `node:crypto`, deliberately kept out of tokens.ts so middleware's import graph never touches it |
| `lib/services/auth/validation.ts` | Login-credential and create-user validation |
| `lib/services/auth/authService.ts` | `login`, `refreshSession` (rotation + reuse detection), `logout`, `createUser` |
| `lib/services/auth/index.ts` | Public barrel (documents the middleware exception) |
| `lib/services/auditLog/securityAuditLogService.ts` | The Security Audit Events producer described above |

**Middleware, routes, seed script:**

| File | Why |
|---|---|
| `middleware.ts` | The sole place authentication happens — see above |
| `app/api/auth/{login,refresh,logout,me}/route.ts` | Login is rate-limited (10/15min — the one real brute-force target in this module); refresh/logout read the refresh cookie via `next/headers`'s `cookies()`; `me` requires only `requiredRole: "counsellor"` (any authenticated role) |
| `scripts/createAdminUser.ts` | CLI bootstrap for the first account — no public self-registration endpoint exists by design; durable only once `MONGODB_URI` is configured |

### Files modified

| File | Change |
|---|---|
| `lib/api/roles.ts` | Rewritten: `AdminRole` = `UserRole`, real rank hierarchy, `getAuthContext(headers)` reads trusted `x-auth-*` headers instead of always returning `{}` |
| `lib/api/withApiRoute.ts` | `getAuthContext(request.headers)`; splits 401 vs 403; records `ACCESS_FORBIDDEN` (security-audit) on every role-gate rejection |
| `lib/api/errors.ts` | `UnauthorizedApiError` (401), field-errors-capable like the others |
| `lib/api/cookies.ts` | `setAuthCookies`/`clearAuthCookies` — the one place the cookie flag set (httpOnly, `sameSite: "lax"`, path scoping) is defined, shared by login/refresh/logout |
| `lib/api/index.ts` | Exports `UnauthorizedApiError`, the `AUTH_HEADER_*` constants (the one intentional exception to "don't export roles.ts internals" — middleware.ts needs them), `setAuthCookies`/`clearAuthCookies` |
| `lib/db/registry.ts`, `lib/db/index.ts` | `getUserRepository()`, `getRefreshTokenRepository()` added |
| `lib/db/repositories/types.ts` | `AuditEntityType` gained `"User"` |
| `lib/services/auditLog/actions.ts` | `AUDIT_ACTIONS.USER_CREATED` (business); new `SECURITY_AUDIT_ACTIONS` registry |
| `lib/services/auditLog/index.ts` | Exports `securityAuditLogService`, `SECURITY_AUDIT_ACTIONS` |
| `AUDIT_ARCHITECTURE.md` | Status note updated — decision 3's deferred revisit is now fulfilled |
| `package.json` | New deps: `jose`, `bcryptjs` (its own TS types — the stale `@types/bcryptjs` shim was installed then deliberately removed) |

**No existing UI file was touched.**

### Live verification (not just build-time)
- **The build itself caught a real bug**: the edge-runtime `node:crypto` issue above, fixed and reverified with a clean rebuild (no Turbopack warnings, `ƒ Proxy (Middleware)` present in the route list).
- **Direct `authService` calls** (one process, real code, not reimplemented): user creation + duplicate-email + weak-password rejection; login success, wrong-password, and unknown-email all returning the *same* generic message (no enumeration); JWT claims verified correct and tamper-detection confirmed (flipping two characters breaks signature verification); all nine role-hierarchy combinations across Counsellor/Manager/Admin; refresh rotation issuing a genuinely new refresh token; **reuse detection** — replaying an already-rotated token fails with `reason: "reused"`, and the second token from that same family is also dead afterward (whole-family revocation, not just one record); garbage/missing refresh tokens rejected; logout kills the refresh token immediately.
- **Real time-based expiry**: with `JWT_ACCESS_TOKEN_TTL_SECONDS=1`, a token verifies immediately and is rejected 2 seconds later — not simulated.
- **Disabled-account handling**: a user disabled mid-session is rejected on a fresh login attempt *and* on refreshing their still-existing session (`reason: "user_inactive"`).
- **Live HTTP against a real running server**, using JWTs minted with a shared `JWT_ACCESS_TOKEN_SECRET` (the only way to test cross-process verification without a configured database — see the module's own note on why in-memory state can't be seeded across processes): no cookie → `401`; garbage cookie → `401`; valid Admin token → `200` (the first admin route in this entire project to ever return real data instead of a fail-closed rejection); valid Manager/Counsellor tokens against an admin-only route → `403`; Counsellor token against `/api/auth/me` (lowest tier) → `200`.
- **Login over real HTTP**: malformed JSON → `400`; missing fields → `401` with field-specific messages; well-formed-but-wrong credentials → `401` generic message; **no `Set-Cookie` header on any failed login**; rate limiting engages and holds at `429` past the configured threshold.
- **Security audit trail cross-checked against the exact test scenarios**: server logs showed `access.forbidden` recorded exactly twice (matching the two 403s) and `user.login_failed` exactly eight times (matching the eight non-rate-limited failed attempts, correctly excluding the rate-limited ones, which never reach `authService.login()`).
- **Regression**: homepage and the public `POST /api/campaigns` unaffected — still `200`/`400` as before, not accidentally gated.
- `git status` confirms the same frozen UI/package file set as every prior module — no UI file touched.

### Future considerations
- No route re-scopes `requiredRole` down to `"manager"`/`"counsellor"` for any existing admin route — flagged above as a product decision, not an oversight.
- No "logout all devices" endpoint — `RefreshTokenRepository.revokeFamily()` exists and is exercised (by reuse detection), just not exposed as a user-facing action yet.
- No "update user" (disable an account, change a role) route — the live-verification script reached into the repository directly to simulate this. A future admin-facing user-management module would reuse `validateCreateUserInput`'s pattern.
- `middleware.ts`'s matcher covers `/api/admin/:path*` and `/api/auth/me` only — there is no admin UI to protect yet (every module so far is backend-only). A future dashboard's pages would extend it.
- Next.js 16 deprecates the `middleware.ts` file convention in favor of `proxy.ts` (a build-time warning, not an error — `middleware.ts` still works correctly, confirmed by this module's full build and live verification). Not migrated now: the replacement convention's exact contract wasn't verified against documentation, and guessing at a rename risked breaking something that currently works. Worth revisiting once confirmed.

---

## Marketing Dashboard (requested as "Module 8")

**Goal:** architecture for Meta Ads, Google Analytics, Campaign Metrics,
Lead Funnel, Conversion Funnel, Revenue Funnel, ROAS/CTR/CPC/CPA —
reusable services, no UI.

**The defining honesty decision, made before writing any code.** Three
of the ten requirements have no real data source anywhere in this
codebase: Meta Ads and Google Analytics are third-party *reporting* APIs
(distinct from the GA4/Meta Pixel *tracking* scripts built in the Meta
Pixel + Google Analytics module — those send events, these would read
aggregated data back) with no credentials configured, and Revenue Funnel
/ ROAS depend on a Payments module `ARCHITECTURE.md` has always flagged
as "not started." Rather than fabricate numbers, every metric shape
carries a `dataAvailable: boolean` (ads/web-analytics) or uses `null`
fields (revenue) — `0` and "no data" are never conflated, since a
disconnected dashboard silently reporting `0` ad spend would be a false
claim, not a safe default. Provider abstraction mirrors the WhatsApp
Provider Architecture module exactly: an interface, a working "no data"
default (selected when no provider is configured), and a real-vendor
stub (`meta-ads`, `google-analytics`) that throws
`MarketingProviderNotImplementedError` when actually invoked, so a
genuine misconfiguration fails loudly instead of silently. The
dashboard-facing services (funnels, campaign metrics) catch that error
and degrade the affected section to "unavailable" rather than let one
unintegrated provider take down the whole response — verified live, see
below.

**New, narrow schema addition.** `Campaign` gained an optional
`externalAdCampaignId` — the ad platform's own campaign id, needed to
query spend for a specific campaign. Deliberately not reusing
`utmCampaign` (a free-text string used to attribute inbound Leads):
ad-platform reporting APIs are queried by their own campaign id, a
different concept that happens to often correlate with the same
campaign.

**Revenue Funnel per-campaign ROAS is always `null`, not just
account-wide.** Revenue isn't attributed per-campaign anywhere in this
app (no Payments module), so there is nothing correct to divide by
per-campaign spend. Account-wide ROAS is still computed when both total
ad spend and total revenue are available — the one place a real,
non-null ROAS is currently possible.

### Files created

| File | Why |
|---|---|
| `config/marketing.ts` | Provider selection (`MARKETING_ADS_PROVIDER`, `MARKETING_WEB_ANALYTICS_PROVIDER`) + credentials, same shape as `config/whatsapp.ts`; deliberately not `NEXT_PUBLIC_*` — server-side reporting reads, not client-side tracking |
| `lib/services/marketing/types.ts` | `AdsProvider`/`WebAnalyticsProvider`/`RevenueProvider` interfaces, funnel/derived-metric shapes |
| `lib/services/marketing/errors.ts` | `MarketingProviderNotImplementedError` — same role as `WhatsAppProviderNotImplementedError` |
| `lib/services/marketing/providers/noAdsData.provider.ts`, `noWebAnalyticsData.provider.ts`, `noRevenueData.provider.ts` | Default providers — always succeed, report `dataAvailable: false` |
| `lib/services/marketing/providers/metaAds.provider.ts`, `googleAnalytics.provider.ts` | Real-vendor scaffolds — throw `MarketingProviderNotImplementedError` when invoked, same status as the 4 unintegrated WhatsApp vendor stubs |
| `lib/services/marketing/registry.ts` | The one seam that turns a configured provider id into a concrete instance — only file allowed to import a concrete adapter |
| `lib/services/marketing/metrics.ts` | Pure `calculateCtr`/`calculateCpc`/`calculateCpa`/`calculateRoas` (+ shared `safeDivide`) — divide-by-zero → `null`, never `NaN`/`Infinity` |
| `lib/services/marketing/funnels.ts` | `getLeadFunnel()`, `getConversionFunnel()`, `getRevenueFunnel()` — real internal data (Lead/Registration) combined with provider data, graceful degradation on provider failure |
| `lib/services/marketing/campaignMetrics.ts` | `getCampaignMarketingMetrics()` (per-campaign), `getOverallMarketingMetrics()` (account-wide, capped at 200 campaigns summed) |
| `lib/services/marketing/index.ts` | Public barrel — providers/registry/errors are implementation detail |
| `app/api/admin/marketing/route.ts` | Consolidated `GET`, `requiredRole: "admin"` (fails closed, same pattern as every Admin Dashboard Backend route) — funnels + overall metrics + per-campaign breakdown, date-range query params default to the trailing 30 days |

### Files modified

| File | Change |
|---|---|
| `lib/db/repositories/types.ts`, `lib/db/models/campaign.model.ts` | `Campaign`/`CreateCampaignInput` gained optional `externalAdCampaignId` |
| `lib/services/campaigns/validation.ts` | Validates/trims the new optional field |
| `lib/services/campaigns/campaignService.ts` | Added `getCampaignById()` — needed to resolve a campaign's `externalAdCampaignId` before querying ad spend |

**No existing UI file was touched.**

### Live verification (not just build-time)
- **Regression**: `/api/admin/marketing` returns `403` (fail-closed, including with the same wrapper every other admin route uses); public routes unaffected.
- **Pure metrics**: CTR/CPC/CPA/ROAS verified against known ratios and against zero-denominator cases (all correctly `null`, never `NaN`/`Infinity`).
- **Real data, default (unconfigured) providers** — seeded 1 campaign (with `externalAdCampaignId`) + 3 leads + 2 registrations via the real services, then confirmed: Lead Funnel counts real leads but reports `visitors: null` (not `0`); Conversion Funnel's rate is computed correctly from two real entities; Revenue Funnel's `paidStudents`/`totalRevenueInr` are `null`; Campaign Metrics reflects the real `registrationCount` with `ads.dataAvailable: false`; `getCampaignMarketingMetrics()` returns `null` for an unknown campaign id.
- **Real vendor stubs selected** (`MARKETING_ADS_PROVIDER=meta-ads`, `MARKETING_WEB_ANALYTICS_PROVIDER=google-analytics`, set via the shell environment): confirmed both throw `MarketingProviderNotImplementedError` when called directly — but `getLeadFunnel()`, `getCampaignMarketingMetrics()`, and `getOverallMarketingMetrics()` all still return successfully, with the affected fields correctly marked unavailable and a structured `warn` log emitted — proof one unintegrated provider degrades its own section instead of crashing the dashboard.

### Future considerations
- Both vendor stubs (`metaAds.provider.ts`, `googleAnalytics.provider.ts`) carry an illustrative request sketch in their file comments (endpoint shape, auth mechanism) for whoever integrates them — same convention as the WhatsApp vendor stubs.
- `RevenueProvider` has only one implementation (`noRevenueData.provider.ts`) since there's no third-party vendor to scaffold — real revenue data is this app's own future Payments module. Everything downstream (`getRevenueFunnel`, `getOverallMarketingMetrics`'s ROAS) is already written against the interface and needs no changes once that module exists.
- No route for creating/editing a campaign's `externalAdCampaignId` yet — set via `POST /api/campaigns`'s existing body, no new endpoint needed.
- `getOverallMarketingMetrics()` sums spend across up to 200 campaigns per call; revisit with true pagination if a real deployment's campaign count grows past that.

---

## Admin Dashboard Backend (requested as "Module 7")

**Goal:** Lead Management, Campaign Tracking, Registration Analytics,
UTM Analytics, Attendance, Student Status, all with filters/pagination/
search/CSV export, plus role-ready architecture — backend only, no UI.

**Note on numbering:** requested as "Module 7," which already exists as
Automation Engine. Titled here by what it actually is.

**The defining security decision, made before writing any code.**
"Lead Management" here means bulk PII listing and export (names, emails,
phone numbers) — a materially higher-stakes gap than the "no auth yet,
but reachable" warnings already flagged on `/api/campaigns` and
`/api/registrations` (which only ever risked spurious low-value
records). Rather than repeat that pattern, `withApiRoute` gained a
`requiredRole` option backed by `lib/api/roles.ts`'s `getAuthContext()`
— which, since no auth system exists, always returns no role. Every
route in this module (`requiredRole: "admin"`) therefore **fails closed**:
verified live to return `403` for every real request, including
`?format=csv` (the gate runs in the wrapper, before the handler, so
there's no per-branch way to accidentally miss it). This is a stronger
posture than "reachable with a warning comment" — the full backend is
genuinely complete and was verified by calling the services directly,
not through HTTP, exactly because HTTP is deliberately not usable yet.

**Attendance scope, deliberately smaller than `ARCHITECTURE.md`'s
original sketch.** That document proposed a full `Session`/`Cohort`
hierarchy; neither exists in this codebase, and `Registration` itself
only has a free-text `cohortLabel`. Built `Attendance` tied directly to
`Registration` with a free-text session label instead — matching the
schema's actual current maturity rather than adding a speculative
subsystem nothing yet needs.

### Files created

**Shared API utilities:**

| File | Why |
|---|---|
| `lib/pagination.ts` | `PaginationParams`/`PaginatedResult<T>` — layer-neutral (not under `lib/api` or `lib/db`), since pagination has nothing to do with HTTP specifically |
| `lib/api/pagination.ts` | `parsePaginationParams()` — the one HTTP-specific piece (query-string parsing) |
| `lib/api/csv.ts` | `toCsv()` — plain serialization, no library needed |
| `lib/api/roles.ts` | `AdminRole`, `getAuthContext()` (fail-closed placeholder), `hasRequiredRole()` |

**New entity (Attendance):**

| File | Why |
|---|---|
| `lib/services/attendance/{types,validation,attendanceService,index}.ts` | Standard service-module shape; `markAttendance()` verifies the referenced `registrationId` is real first, same pattern as `registrationService` verifying `leadId`/`campaignId` |
| `lib/db/models/attendance.model.ts`, `attendance.mongodb.repository.ts`, `attendance.inMemory.repository.ts` | Standard dual-repository pattern on the shared connection |

**Cross-entity orchestration:**

| File | Why |
|---|---|
| `lib/services/adminAnalytics/index.ts` | `getStudentStatusSummary()` — the one piece of analytics that genuinely spans two entities (Registration + Attendance); kept deliberately small (one file) rather than a whole new module structure, since UTM/Registration analytics are each a single entity's own concern and live on that entity's existing service |

**Routes** (all `requiredRole: "admin"`):

| File | Role |
|---|---|
| `app/api/admin/leads/route.ts` | Lead Management — filters, search, pagination, CSV |
| `app/api/admin/campaigns/route.ts` | Campaign Tracking — all campaigns (not just active), filters, CSV |
| `app/api/admin/registrations/route.ts` | Filtered/paginated registration listing, CSV |
| `app/api/admin/attendance/route.ts` | `GET` list + `POST` mark, CSV |
| `app/api/admin/analytics/route.ts` | Registration Analytics + UTM Analytics + Student Status, one payload |

### Files modified — extending the 3 existing entities

| File | Change |
|---|---|
| `lib/services/leads/types.ts`, `leadService.ts`, `index.ts`, `repositories/inMemory.repository.ts`, `lib/db/repositories/lead.mongodb.repository.ts` | `LeadRepository` gained `list()` (filters + search, regex-escaped against injection) and `utmBreakdown()` (Mongo `$group` aggregation / in-memory reduce) |
| `lib/db/repositories/types.ts`, `campaign.mongodb.repository.ts`, `campaign.inMemory.repository.ts`, `lib/services/campaigns/{campaignService,types,index}.ts` | `CampaignRepository` gained `list()` — every campaign, not just `listActive()`'s subset |
| `lib/db/repositories/types.ts`, `registration.mongodb.repository.ts`, `registration.inMemory.repository.ts`, `lib/services/registrations/{registrationService,types,index}.ts` | `RegistrationRepository` gained `findById()`, `list()`, and `analytics()` (status + program breakdown in one call, since both are cheap full-collection scans at this volume) |
| `lib/db/registry.ts`, `lib/db/index.ts` | `getAttendanceRepository()` added, same pattern as the other 5 entities |
| `lib/api/errors.ts` | `ForbiddenApiError` (403) |
| `lib/api/withApiRoute.ts` | `ApiRouteContext` gained `authContext`; `WithApiRouteOptions` gained `requiredRole`, enforced before the handler runs |
| `lib/api/index.ts` | Exports the new pagination/CSV/role pieces (not `getAuthContext`/`hasRequiredRole` themselves — routes configure gating via `requiredRole`, same pattern as rate limiting) |

**No existing UI file was touched.**

### Live verification (not just build-time)
- **Security**: all 6 admin endpoints (5 `GET`, 1 `POST`) return `403` over real HTTP, including with `?format=csv` appended — confirms the gate can't be bypassed via query params.
- **Regression**: homepage, `GET /api/campaigns`, `POST /api/leads` all still `200`/`201` after this module's changes.
- **Full business logic**, verified via direct service calls (the same technique used to test every fail-closed-by-design route this session): seeded 3 leads across 2 UTM combinations, 2 campaigns (one active, one draft), one registration, two attendance records (one present, one absent) — then confirmed, exactly:
  - Search (`"alice"` → 1 match), source filter (`meta-ad` → 2 matches), pagination (`limit=1, page=2` → 1 item, `totalPages: 3`).
  - Campaign listing returns **both** active and draft (unlike the public `listActive()`), and status filtering works.
  - Registration Analytics: correct `byStatus`/`byProgram` breakdown.
  - UTM Analytics: correct aggregation — `meta/cpc/summer → 2`, `google/cpc/winter → 1`.
  - Attendance listing scoped to one registration returns exactly its 2 records.
  - Student Status: `overallAttendanceRate: 0.5` — correctly computed from 1 present out of 2 recorded sessions.
  - CSV serialization produces correctly-formatted output.
  - As a side confirmation: the automation engine (previous module) still correctly started a workflow for each new lead and stopped one early on conversion — proof this module's changes didn't disturb it.

### Future considerations
- Every route in this module is inert until real authentication exists —
  intentional, not a gap to silently work around. When auth is built,
  `lib/api/roles.ts`'s `getAuthContext()` is the one function that
  changes; no route file needs to.
- No "update Lead status" / "update Registration status via admin
  action" endpoints — out of scope for a request framed as
  filters/search/pagination/export over existing data, not a full CRUD
  admin surface. `RegistrationRepository.updateStatus()` already exists
  and is unused by this module for the same reason it was unused before.
- CSV export loads up to 5,000 rows per request rather than true
  streaming — adequate at current volume; revisit if a real deployment's
  lead count grows enough to matter.
- `Attendance` has no bulk-import path (e.g., a trainer's spreadsheet) —
  only single-record `POST`. A future CSV-import endpoint would reuse
  the same validation as `markAttendance()`.

---

## Automation Engine (requested as "Module 6")

**Goal:** a workflow engine — triggers, delays, scheduled advancement,
conditional steps, retry policies, event-driven architecture — plus the
concrete example workflow: Lead Registered → Welcome → Reminder → Offer,
with "Student Conversion" stopping the sequence early.

**Note on numbering:** requested as "Module 6," which already exists as
Registration Service. Titled here by what it actually is.

**The defining architectural constraint, decided before writing any
code:** Next.js serverless functions are ephemeral and cannot hold a
multi-day delay in memory (`setTimeout` across days is not a real
option). Every workflow step's "wait" is therefore not a timer — it's a
persisted `nextRunAt` timestamp on a `WorkflowRun` document, advanced by
a poller (`runDueWorkflowSteps()`) that a future scheduled trigger would
call repeatedly. This is the same "queue-ready" pattern already
established for WhatsApp sends (`processSendJob()`) and audit-log
retention (`pruneExpiredAuditLogs()`), applied to a third kind of
deferred work.

**"Student Conversion" is an event-driven exit, not a 4th step.**
Conversion is the outcome the workflow drives toward, not an action it
performs. `triggers.ts` also subscribes to `registration.created` and
marks any of that lead's in-flight workflow runs `"completed"`
(`completionReason: "converted"`) the moment they register — verified
live to fire immediately, without waiting for the poller.

### A real bug, found only by testing against a running server

Standalone test scripts (each running as one Node process/module graph)
passed cleanly on the first try. Testing the *actual* HTTP path — `curl
POST /api/leads` against a real `npm run start` server — showed
`subscriberCount: 0` even though diagnostic logging confirmed
`instrumentation.ts`'s `register()` ran and completed. **Next.js bundles
`instrumentation.ts` and API route handlers into separate module
graphs**, so the event bus's module-level `handlers` `Map` was not the
same object across them — a subscription registered from one copy was
invisible to `publish()` calls from another, even within a single
running process. This is a genuine framework/bundler behavior, not a
mistake in the registration logic itself, and it would not have been
caught by unit-style testing in isolation — only by exercising the real
deployed shape of the app.

**Fix:** `publish()` now self-bootstraps its own subscribers on first
call (a dynamic import from inside `lib/events/eventBus.ts` itself),
guaranteeing the registration happens in the *same* module instance
that's about to use it, regardless of how Next.js chooses to bundle
things. `instrumentation.ts` was removed — it's now redundant, and
leaving it in place would have been actively misleading (a file whose
own doc comment claims to do something it demonstrably doesn't
reliably do).

### Files created

**Event system:**

| File | Why |
|---|---|
| `lib/events/types.ts` | `DomainEvent`, `EventHandler` |
| `lib/events/eventBus.ts` | `publish`/`subscribe` — in-process pub/sub, self-bootstrapping (see above) |
| `lib/events/index.ts` | Barrel |

**Automation engine:**

| File | Why |
|---|---|
| `lib/services/automation/types.ts` | `WorkflowRun` (persisted state) vs. `WorkflowDefinition`/`WorkflowStep` (code, not admin-editable data — no admin UI exists to justify that investment) |
| `lib/services/automation/engine.ts` | `startWorkflowRun`, `advanceWorkflowRun` (condition → execute → retry-or-advance), `runDueWorkflowSteps` (the poller) |
| `lib/services/automation/triggers.ts` | Wires every `WorkflowDefinition`'s trigger event, plus the `registration.created` → stop-on-conversion rule |
| `lib/services/automation/workflows/leadNurtureSequence.ts` | The concrete example workflow from the brief |
| `lib/services/automation/workflows/index.ts` | Workflow registry |
| `lib/services/automation/index.ts` | Public barrel — `registerAutomationTriggers`, `runDueWorkflowSteps`, types. Engine internals (`startWorkflowRun`/`advanceWorkflowRun`) and repository implementations stay unexported |

**Persistence** (same shared `lib/db/` connection/registry pattern as every other entity):

| File | Why |
|---|---|
| `lib/db/models/workflowRun.model.ts` | Indexes: `{status, nextRunAt}` (the poller's query), `{entityType, entityId, status}` (stop-on-conversion lookup) |
| `lib/db/repositories/workflowRun.mongodb.repository.ts` / `workflowRun.inMemory.repository.ts` | Standard dual-repository pattern |

### Files modified

| File | Change | Why |
|---|---|---|
| `lib/db/repositories/types.ts`, `registration.mongodb.repository.ts`, `registration.inMemory.repository.ts` | `RegistrationRepository` gained `findByLead(leadId)` | The Offer step's condition needs "has this lead converted to *anything*," not one specific program slug |
| `lib/db/registry.ts`, `lib/db/index.ts` | `getWorkflowRunRepository()` added, same pattern as the other 4 entities | |
| `lib/services/whatsapp/whatsappService.ts` | Added `sendTemplateMessage()` — a generic template send | The 2 existing named methods (`sendRegistrationConfirmation`, `sendCohortReminder`) don't fit a multi-step sequence needing arbitrary template names per step |
| `lib/services/leads/leadService.ts` | Publishes `lead.created` after a successful (non-duplicate) creation | The trigger for the whole nurture sequence |
| `lib/services/registrations/registrationService.ts` | Publishes `registration.created` after success | The trigger for the early-exit rule |

**No existing UI file was touched.**

### Live verification (not just build-time)
- **Happy path**, all 3 steps, via the real production modules directly (not mocked): Lead created → event published → `WorkflowRun` started at step 0 → poll executes Welcome (console provider) → advances to Reminder, `waiting`, `nextRunAt` correctly ~1 day out → an immediate second poll correctly processes **zero** (not due yet) → manually fast-forwarded `nextRunAt` → poll executes Reminder → advances to Offer, ~2 days out → fast-forwarded again → condition evaluated (no registration exists) → Offer executes → workflow `completed` (`sequence_finished`).
- **Event-driven early exit**: a second lead's workflow reached the `waiting` state for Reminder, then that lead registered for a program — the run was marked `completed`/`converted` **immediately**, before any poll, confirmed via direct repository inspection (not present in `findDue()` even with a 100-day lookahead window).
- **Retry policy, against Meta's real, live API** (not mocked, same technique as the WhatsApp module): a third lead's Welcome step failed against a genuinely invalid access token — first failure rescheduled with the correct ~15-minute backoff, attempt count `1`; an immediate second poll correctly processed zero (backoff not elapsed); after fast-forwarding, the second real failure exhausted `maxAttempts: 2` and the run was correctly marked permanently `failed`.
- **The bug above**, found and fixed via testing against a real running server, then re-verified on that same real server: `subscriberCount` went from `0` to `1`, and `automation.workflow_started` fired correctly via the actual HTTP path.
- Full regression sweep: `/api/leads`, `/api/campaigns` (GET+POST), `/api/webhooks/whatsapp` all still respond correctly.

### Future considerations
- `runDueWorkflowSteps()` has no scheduled trigger yet — same gap as
  audit-log retention pruning, and for the same reason: no
  cron/scheduler infrastructure exists, and an unauthenticated
  "advance all pending workflows" route would be a bad idea without
  auth in front of it first.
- `WorkflowDefinition`s are code, not DB-editable data — revisit if an
  admin UI ever needs to let non-engineers author or adjust a sequence.
- Only one workflow is registered. Adding a second is one new file in
  `workflows/` plus one line in `workflows/index.ts` — the engine,
  triggers, and persistence layer are all already generic.
- `AuditLogModel` still isn't written to by the automation engine itself
  (only by the services it's triggered from) — a
  `"workflow.step_completed"` business audit event is a reasonable
  future addition if workflow history needs to be queryable the same
  way Lead/Campaign/Registration history is.

---

## Meta WhatsApp Cloud API Integration (requested as "Module 5")

**Goal:** turn the Meta Cloud API adapter — scaffolded but deliberately
unimplemented since the original WhatsApp Provider Architecture module —
into a real, working integration: sending, webhook verification,
delivery/read status, retry logic, a queue-ready send path, and logging.
The other 4 vendor adapters (AiSensy, Interakt, WATI, Gallabox) remain
scaffolded stubs — out of scope here, same as originally decided.

**Note on numbering:** requested as "Module 5," which already exists as
Campaign Service. Titled here by what it actually is, both stand as built.

**Provider abstraction extended, not bypassed.** `WhatsAppProvider`
gained two methods (`verifyWebhookChallenge`, `parseWebhookEvent`) so
webhook handling flows through the same dependency-inversion boundary as
sending — the webhook route calls `whatsappService`, which calls
`getWhatsAppProvider()`, never a hardcoded reference to Meta. All 6
providers (including the 4 stubs and the `console` dev default) needed
to implement the extended interface to keep it uniform; the 4
unintegrated vendors got stub versions of the two new methods, same
pattern as their existing `sendText`/`sendTemplate` stubs.

### Files created

| File | Why |
|---|---|
| `lib/services/whatsapp/retry.ts` | Generic exponential-backoff retry wrapper, kept vendor-agnostic so a future real adapter can reuse it |
| `lib/services/whatsapp/queue.ts` | `WhatsAppSendJob` (a plain, serializable send description) + `processSendJob()` — the "queue-ready" seam: a pure function over serializable input that a real queue consumer could call unmodified later. Today `whatsappService` calls it directly ("a queue of one, run now") |
| `app/api/webhooks/whatsapp/route.ts` | `GET` (Meta's one-time verification handshake) + `POST` (delivery/read/failed status events), both on Module 4's `withApiRoute` |

### Files modified

| File | Change | Why |
|---|---|---|
| `lib/services/whatsapp/types.ts` | `WhatsAppProvider` gained `verifyWebhookChallenge()`/`parseWebhookEvent()`; added `WhatsAppWebhookChallenge`, `WhatsAppWebhookEventType`, `WhatsAppWebhookEvent` | The vendor-agnostic webhook contract |
| `lib/services/whatsapp/providers/metaCloudApi.provider.ts` | Rewritten from a throwing stub into a real adapter: `fetch()`-based send with retry, HMAC-SHA256 webhook signature verification (constant-time comparison via `timingSafeEqual`), status-event parsing | The actual deliverable of this module |
| `lib/services/whatsapp/providers/console.provider.ts` | Working (not stubbed) implementations of the 2 new methods, consistent with its role as the always-functional dev default | |
| `lib/services/whatsapp/providers/{aisensy,interakt,wati,gallabox}.provider.ts` | Stub implementations of the 2 new methods, matching their existing pattern | Interface uniformity across all 6 providers |
| `lib/services/whatsapp/whatsappService.ts` | Sends now route through `processSendJob()` instead of calling the provider directly; gained `verifyWebhookChallenge()`/`parseWebhookEvent()` passthrough methods | `getWhatsAppProvider()` stays fully internal to the module even for webhook handling |
| `lib/services/whatsapp/index.ts` | Exports the 3 new webhook types | |
| `config/whatsapp.ts` | `META_CLOUD_API_CONFIG` gained `webhookVerifyToken`, `appSecret` | Webhook verification needs credentials distinct from the outbound `accessToken` |
| `.env.local` | Added `WHATSAPP_META_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_META_APP_SECRET`; updated the stale "none of the 5 vendor adapters are integrated" comment | |

**No existing UI file was touched.**

### Live verification (not just build-time) — the important part
- **GET verification handshake**: correct token → `200`, echoes `hub.challenge` verbatim; wrong token → `403`.
- **POST webhook signature verification**: computed a real HMAC-SHA256 signature over a realistic Meta status payload using a test app secret — valid signature → `200`, event correctly parsed (`type: "delivered"`, correct `providerMessageId`, unix timestamp converted to ISO, recipient id correctly formatted to E.164 with `+`); tampered signature → `401`; missing signature → `401`.
- **Send + retry, against Meta's real, live Graph API** (not mocked): sent with a syntactically-invalid access token. The request actually reached `graph.facebook.com` and returned Meta's real, documented error (`code: "190"`, *"Invalid OAuth access token — Cannot parse access token"*) — confirming genuine network connectivity and correct response parsing, not a fabricated result. **832ms elapsed**, not 3.5+ seconds — proof the retry logic correctly classified a 401-class error as non-retryable and failed fast rather than burning 3 attempts on a request that could never succeed.
- Regression: `POST /api/leads` still works identically (`201`, audit-logged) after all of the above.

### Future considerations
- `whatsappService` still has no caller from `leadService`/`registrationService` — same deliberate gap as before this module; the natural integration point is `registrationService.createRegistration()` calling `sendRegistrationConfirmation()` after a successful registration.
- Retryable-path behavior (a genuine 429/5xx triggering an actual retry-with-backoff) wasn't exercised live — Meta doesn't return those on demand without a working account to legitimately rate-limit or degrade. The non-retryable path was verified live instead, which exercises the same decision logic (`isRetryable()`) from the other side of the same branch.
- Inbound message *content* (a reply, not a status update) isn't parsed — scoped to delivery/read/failed status events only, matching what was asked. A future feature (a two-way chat, an opt-out keyword handler) would extend `parseWebhookEvent()`'s payload shape.
- `processSendJob()` has no real queue in front of it yet — see the file's own doc comment for exactly what swapping one in would look like.

---

## Audit Logging

**Goal:** implement `AUDIT_ARCHITECTURE.md`'s approved design — Business
Audit Events for `lead.created`/`campaign.created`/`registration.created`
only, 365-day configurable retention with future-archival support, and a
formal three-way split between Business Audit Events, System/Operational
Logs, and (not-yet-built) Security Audit Events.

**Layering fix, done first because the design required it.** A service
must not depend on the API layer (established when `CampaignValidationError`
was kept independent of `lib/api`'s `ApiFieldError`) — but `auditLogService`
needs to log its own write failures, and the only logging mechanism that
existed was `lib/api/logger.ts`. Extracted the shared primitive into a
new, layer-neutral `lib/logger.ts`; `lib/api/logger.ts` is now a thin
request-scoped wrapper around it, with its public API (`createRequestLogger`)
completely unchanged. `auditLogService` uses the shared primitive
directly, never importing `lib/api`.

### Files created

| File | Why |
|---|---|
| `lib/logger.ts` | Shared structured-logging primitive underneath both `lib/api/logger.ts` (operational) and `auditLogService` (business-write failures) — the piece that lets both exist without either depending on the other |
| `config/auditLog.ts` | `AUDIT_LOG_RETENTION_DAYS`, default 365, env-overridable |
| `lib/services/auditLog/types.ts` | `RecordAuditEventInput<TMetadata>` (generic — each call site gets compile-time-checked metadata shape), `AuditContext` (the `requestId`-only object threaded from the API layer) |
| `lib/services/auditLog/actions.ts` | `AUDIT_ACTIONS` — the 3 approved action names, one place to see the full list, explicit comment on what's deliberately excluded and why |
| `lib/services/auditLog/archiver.ts` | `AuditLogArchiver` interface + `noopArchiver` default — the extension point "support future archival" requires |
| `lib/services/auditLog/retention.ts` | `pruneExpiredAuditLogs()` — archives before deleting, and skips deletion entirely if archiving throws. Not a TTL index (see design note in `AUDIT_ARCHITECTURE.md` §7); not wired to run automatically |
| `lib/services/auditLog/auditLogService.ts` | `record()` — never throws, logs+swallows failures; also logs a `audit.recorded` success line (added during implementation — without it, "the pipeline is silently broken" and "nothing happened" look identical from outside). `listForEntity()` — thin pass-through to the already-built repository method |
| `lib/services/auditLog/index.ts` | Public barrel |

### Files modified

| File | Change | Why |
|---|---|---|
| `lib/api/logger.ts` | Refactored to build on `lib/logger.ts`; public API unchanged | The layering fix above |
| `lib/db/repositories/types.ts` | `AuditLogEntry`/`CreateAuditLogInput` gained `category: "business" \| "security"`, `actorType: "system" \| "user" \| "api"`, `requestId?`; `AuditLogRepository` gained `findOlderThan()`/`deleteByIds()` | The three-way category split + the fields retention pruning needs |
| `lib/db/models/auditLog.model.ts` | Schema/document/mapper updated to match. No new indexes added — no query pattern needs one yet (matches this document's own §6 principle: index cost proportional to actual need, not speculative) | |
| `lib/db/repositories/auditLog.mongodb.repository.ts` | Implements `findOlderThan()`/`deleteByIds()` | |
| `lib/db/repositories/auditLog.inMemory.repository.ts` | Same two methods; `record()` now defaults `actorType` to `"system"` (matching Campaign's `status` default pattern) | |
| `lib/db/index.ts` | Exports `AuditCategory`, `AuditActorType` | |
| `lib/services/leads/leadService.ts` | `registerLead()` gained an optional `context: AuditContext` param; records `lead.created` on the non-duplicate path only | |
| `lib/services/campaigns/campaignService.ts` | Same pattern; records `campaign.created` on success only, not on the rejected-duplicate path | |
| `lib/services/registrations/registrationService.ts` | Same pattern; records `registration.created` **after** `runInTransaction()` commits, deliberately outside it | An audit-write failure must never roll back a successful Registration + Campaign-count update |
| `app/api/leads/route.ts`, `app/api/campaigns/route.ts`, `app/api/registrations/route.ts` | `handleCreate*` now declares its `ctx: ApiRouteContext` param and passes `{ requestId: ctx.requestId }` through | Correlates a stored audit entry to the exact request that produced it |
| `AUDIT_ARCHITECTURE.md` | Added an approval/implementation status header; original reasoning left unmodified | |

**No existing UI file was touched.**

### A design decision reversed mid-review, confirmed correct by implementation
The design review's §5 initially reasoned toward putting the Registration
audit write *inside* `runInTransaction()`, for atomicity with the
Registration/Campaign writes — then reversed that in the same document
after tracing through §8/§9: an AuditLog hiccup would then have the power
to roll back a perfectly good Registration. Implementation followed the
reversed conclusion — the audit write happens after the transaction has
already committed, never inside it. Worth naming because it's the kind
of thing that's easy to get wrong quietly; this got caught in the design
phase specifically because the review reasoned through all ten points as
one connected argument rather than ten independent answers.

### Live verification (not just build-time)
- Created a lead → `audit.recorded` fired for `lead.created`, correctly
  sandwiched between that request's `request.start`/`request.complete`
  log lines.
- Same lead resubmitted (duplicate touch) → **no** `audit.recorded` —
  confirms the exclusion is real, not just documented.
- Created a campaign → `audit.recorded` fired for `campaign.created`.
- Duplicate campaign code (rejected) → **no** `audit.recorded` —
  confirms rejected attempts are correctly not audited yet.
- Created a registration → `audit.recorded` fired for
  `registration.created`.
- Duplicate registration (idempotent return) → **no** `audit.recorded`.
- Across the entire test session: **zero** `audit.write_failed` entries
  — the pipeline never failed, and if it had, this log line is exactly
  how that would have been visible.
- Regression: homepage and `GET /api/campaigns` both still `200`.

### Future considerations
- `pruneExpiredAuditLogs()` has no scheduled trigger yet — needs either
  a cron-invoked route or a manual admin action, and either way needs
  authentication in front of it first (deleting audit data is a more
  sensitive operation than anything currently unauthenticated in this
  app).
- `noopArchiver` is the only `AuditLogArchiver` implementation — swap in
  a real one (S3, a cold collection) when retention pruning is actually
  scheduled to run.
- No producer for `category: "security"` yet — deferred to when
  authentication/authorization exist, per the approved decision.
- No query surface (`GET /api/audit-logs`) yet — `findByEntity()`/
  `listForEntity()` already exist and are unused, same shape of gap
  Campaign's `listActive()` had before its `GET` route existed.

---

## Module 6 — Registration Service (with Campaign transaction wiring)

**Goal:** a service layer for Registration, wired so that creating one
atomically increments its Campaign's registration count — the first real
use of `runInTransaction()` (built two modules ago, unused until now).

**A real bug, found because this was the first actual caller.**
`runInTransaction()` unconditionally called `mongoose.connect()`. That
was never exercised before — nothing had called the function — and it
would have hung or thrown the moment anything did, in this environment,
where `MONGODB_URI` isn't configured. Fixed in `lib/db/transaction.ts`:
when MongoDB isn't configured, the callback now runs with `session:
undefined` instead of attempting a real connection — every repository
write method already treats a missing session as "no session," so this
is a graceful, correct degradation, not a workaround bolted onto the new
service. This is exactly why "first real caller" moments matter: an
untested seam looks fine right up until something actually uses it.

**A third duplicate-prevention policy, on purpose.** Lead silently
recognizes a repeat submission; Campaign rejects a code collision as a
likely mistake; Registration returns the **existing record as a
success** — a user re-registering for something they're already
registered for isn't an error, it's a no-op that should feel like one.
Verified live: a duplicate registration attempt returns `200` with the
same registration id, and critically, does **not** re-increment the
campaign's counter (traced 0 → 1 → still 1, not 2).

### Files created

| File | Why |
|---|---|
| `lib/services/registrations/types.ts` | `RegistrationValidationError`, `CreateRegistrationResult` — domain type/repository imported from `@/lib/db`, same pattern as Campaign |
| `lib/services/registrations/validation.ts` | Field-level DTO validation only — existence checks (does `leadId`/`campaignId` refer to a real record?) belong in the service, since they need a repository lookup |
| `lib/services/registrations/registrationService.ts` | `createRegistration()`: validate → confirm lead exists → confirm campaign exists (if given) → dedup check → atomic create-and-increment via `runInTransaction()` → race-condition safety net via `DuplicateKeyError` |
| `lib/services/registrations/index.ts` | Public barrel |
| `app/api/registrations/route.ts` | `POST /api/registrations`, rate-limited 10/min/IP, built on the same `withApiRoute`/`apiSuccess`/`parseJsonBody` as the other two routes |

### Files modified

| File | Change | Why |
|---|---|---|
| `lib/db/transaction.ts` | `runInTransaction()` degrades gracefully (runs `fn(undefined)`) when MongoDB isn't configured, instead of calling `mongoose.connect()` unconditionally | The bug described above — found and fixed by actually calling this function for the first time |
| `lib/db/migrations/index.ts` | `Migration.up`'s signature updated to `(session: ClientSession \| undefined)` to match `runInTransaction()`'s corrected type | Ripple effect of the fix above, caught by `tsc` |
| `lib/db/repositories/types.ts` | `Campaign` gained `registrationCount: number` (server-managed, not settable via `CreateCampaignInput`); `CampaignRepository` gained `findById()` and `incrementRegistrationCount()` | Gives the transaction example something concrete to atomically update, and lets `registrationService` validate a `campaignId` before using it |
| `lib/db/models/campaign.model.ts` | Schema field `registrationCount` (default `0`), document interface, and `toCampaign()` mapper updated to match | |
| `lib/db/repositories/campaign.mongodb.repository.ts` | Implements `findById()` (with an `isValidObjectId` guard — a malformed id returns `null`, not a thrown cast error) and `incrementRegistrationCount()` (atomic `$inc`) | |
| `lib/db/repositories/campaign.inMemory.repository.ts` | Same two methods; `registrationCount: 0` initialized on creation | |
| `lib/services/leads/types.ts` | `LeadRepository` gained `findById()` | `registrationService` needs to confirm a client-supplied `leadId` is real before writing a Registration against it |
| `lib/services/leads/repositories/inMemory.repository.ts` | Implements `findById()` | |
| `lib/db/repositories/lead.mongodb.repository.ts` | Implements `findById()` (same `isValidObjectId` guard as Campaign's) | |

**No existing UI file was touched.**

### ⚠️ Known gap, same as Campaign
`POST /api/registrations` has no authentication — flagged in the route
file itself, same reasoning as `/api/campaigns`. Somewhat lower practical
risk here than a bare create endpoint would be, since both `leadId` and
`campaignId` must resolve to real records or the request is rejected
with a clean `400` — but this is still not acceptable on a real
deployment without authorization in front of it.

### Live verification (not just build-time)
- Created a lead, then an `active`-status campaign (`registrationCount: 0`).
- Created a registration linking both — `201`, and the campaign's
  `registrationCount` became `1` on the very next fetch.
- Resubmitted the identical registration — `200`, `duplicate: true`,
  **same registration id**, and `registrationCount` stayed at `1` — the
  dedup path correctly skips the transaction entirely rather than
  double-incrementing.
- A well-formed but nonexistent `leadId` — clean `400`
  (`"No lead found with this id."`), not a crash or a 500.
- Regression: `POST /api/leads` and the duplicate-code rejection on
  `POST /api/campaigns` both produced identical output to every prior
  test this session.
- `npx tsc --noEmit` caught a real type error from the `transaction.ts`
  fix (`lib/db/migrations/index.ts`'s `Migration.up` no longer matched
  the corrected signature) before it ever reached lint or build —
  fixed, then reverified clean.

### Future considerations
- `AuditLogModel` still has no caller. `registrationService.createRegistration()`
  recording a `"registration.created"` entry is a natural next
  integration, deliberately not added here to keep this module scoped to
  the transaction wiring it was asked to build.
- No client-side caller yet (no UI creates registrations) — same
  intentional gap Lead and Campaign both had before anything called them.
- `updateStatus()` on `RegistrationRepository` has no service-layer
  caller yet (e.g., moving a registration from `pending` to `confirmed`
  after payment) — out of scope until a Payments module exists.

---

## Module 5 — Campaign Service

**Goal:** an application/service layer for Campaign — the entity the
Database Layer module gave a repository but no business logic — plus the
`POST`/`GET /api/campaigns` routes needed to actually call it, proving
Module 4's API architecture generalizes past the one route it was built
against.

**Types weren't moved, they were imported.** When the Database Layer
module built `CampaignRepository`, it explicitly documented the plan:
*"when [a service] is built, it imports the repository interface from
here, the same way `leadService.ts` does."* `lib/services/campaigns/types.ts`
does exactly that — imports `Campaign`/`CampaignChannel`/`CampaignStatus`/
`CreateCampaignInput` from `@/lib/db` rather than redefining them, and
only adds what's genuinely new at this layer (`CampaignValidationError`,
`CreateCampaignResult`).

**A different duplicate-prevention policy than Lead — deliberately.**
Lead's dedup policy (silently recognize a repeat submission as the same
person) doesn't fit Campaign: a code collision is almost always a
mistake, made deliberately by a marketer, so `campaignService.createCampaign()`
rejects it with a clear field error instead. Same architecture
(repository lookup + application-level policy decision), a different,
entity-appropriate outcome — proving the split established in the
Database Layer module supports genuine per-entity variation, not just
one hardcoded behavior.

**First real use of `DuplicateKeyError`.** Built in the Database Layer
module, unused until now. `createCampaign()` does a fast check-then-create
(`findByCode` first, for a clean error message on the common case), then
also catches `DuplicateKeyError` from the repository's `create()` call —
the safety net for the race where two concurrent requests both pass the
check before either finishes writing. The database's unique index is the
actual guarantee; the try/catch just turns a raw duplicate-key exception
into the same clean response the common case already returns.

### Files created

| File | Why |
|---|---|
| `lib/services/campaigns/types.ts` | `CampaignValidationError`, `CreateCampaignResult` — everything else re-exported from `@/lib/db` |
| `lib/services/campaigns/validation.ts` | Hand-rolled DTO validation (no zod, matching the codebase's established convention) — includes a business rule beyond field-level checks: `endDate` must be on or after `startDate` |
| `lib/services/campaigns/campaignService.ts` | `createCampaign()` (validate → dedup-check → create, with the race-condition safety net above) and `listActiveCampaigns()` |
| `lib/services/campaigns/index.ts` | Public barrel — `campaignService` + types only |
| `app/api/campaigns/route.ts` | `POST` (create, rate-limited 20/min/IP) and `GET` (list active, rate-limited 60/min/IP), both built on Module 4's `withApiRoute`/`apiSuccess`/`parseJsonBody` |

**No existing UI file was touched.**

### ⚠️ Known gap, flagged deliberately
`POST /api/campaigns` and `GET /api/campaigns` have **no authentication**
— this codebase has no auth system anywhere yet (`ARCHITECTURE.md`:
Auth/Users/RBAC are all "not started"). Anyone who can reach these routes
can create Campaign records today. Acceptable for now (low-stakes data,
no PII, no financial action, and MongoDB isn't even configured in this
environment), but this **must** be gated behind real authorization before
any real deployment exposes it publicly. Flagged prominently in the route
file itself, not just here.

### Live verification (not just build-time)
- Created a campaign (`SUMMER-2026-META`) — `201`, code correctly
  normalized to uppercase.
- Resubmitted the same code (different casing on input) — `400`, clear
  duplicate-specific error message, not a generic validation failure.
- Empty payload — `400` with 4 field-specific errors.
- `endDate` before `startDate` — `400`, the business-rule check firing
  correctly, not just field presence checks.
- Created a second, `active`-status campaign, then `GET /api/campaigns` —
  returned only the active one, confirming `listActive()`'s status
  filter works, not just that the endpoint returns *something*.
- Regression check: `POST /api/leads` produces identical output to every
  prior test in this session — confirms this module's additions didn't
  disturb the shared `lib/api/` infrastructure Module 4 built.

### Future considerations
- No client-side caller yet (no admin UI exists to create/list
  campaigns) — same intentional gap Lead had before `LeadForm` was wired
  to it.
- `Registration` still has a repository but no service layer — the same
  shape of work as this module, once there's a concrete reason to build
  it (e.g., wiring a program registration flow that needs to atomically
  touch both a Registration and a Campaign via `runInTransaction()`,
  which also still has no caller).
- Matching an inbound Lead's `utm.utmCampaign` value to a `Campaign`
  record automatically (via the `utmCampaign` index already on
  `CampaignModel`) is a natural next integration — not done here to keep
  this module scoped to Campaign itself.

---

## Module 4 — API Architecture

**Goal:** the cross-cutting infrastructure every route handler needs —
standardized responses, typed errors, DTO validation, structured
logging, rate limiting — built once as reusable `lib/api/` infrastructure
and applied to the one existing route to prove it works on real code.

**Design decision — no duplicate validation.** `leadService.registerLead()`
(Module 1) already validates its input and returns a result object
rather than throwing. Rather than re-validate the same DTO a second time
at the API layer, `parseJsonBody()` here only does safe JSON parsing for
`/api/leads`; it stays generic enough (optional validator argument) for a
future route that doesn't have its own service-layer validator to use
directly. `leadService`'s contract is completely unchanged.

**Wire compatibility verified, not assumed.** The response envelope
(`{success, ...}`) exactly matches what `/api/leads` already produced —
confirmed by curling all four cases (new lead, duplicate, validation
error, malformed JSON) before and after the refactor and diffing the
output: byte-for-byte identical. `components/lead-modal/LeadForm.tsx`'s
existing `submitLead()` call needed zero changes.

### Files created

| File | Why |
|---|---|
| `lib/api/errors.ts` | `ApiError` hierarchy (`ValidationApiError`, `NotFoundApiError`, `RateLimitedError`) — route code throws these instead of hand-rolling a `NextResponse.json(...)` per failure case |
| `lib/api/response.ts` | `apiSuccess()`/`apiError()` — the standardized `{success, ...}` envelope, formalizing (not changing) the shape `/api/leads` already used |
| `lib/api/logger.ts` | Structured JSON-line logger to stdout/stderr — dependency-free by design; a hosting platform already captures stdout/stderr as searchable logs, so pino/winston would be an unneeded dependency at this stage |
| `lib/api/clientIp.ts` | `x-forwarded-for`/`x-real-ip` extraction for rate-limit keys |
| `lib/api/rateLimit/types.ts` | `RateLimiter` port — same provider-abstraction shape as WhatsApp/Analytics, so a distributed limiter (Redis) is a one-file swap later |
| `lib/api/rateLimit/inMemory.ts` | Fixed-window in-memory limiter, the working default. Documented, known limitation: per-instance state under-limits across multiple serverless instances — an honest trade-off, not a bug, given no distributed store is configured in this environment |
| `lib/api/dto.ts` | `parseJsonBody()` — safe JSON parsing + optional DTO validator, throwing `ValidationApiError` uniformly either way |
| `lib/api/handleError.ts` | `handleApiError()` — the one place a thrown error becomes an HTTP response |
| `lib/api/withApiRoute.ts` | The route wrapper — ties logging, rate limiting, and error handling together around any handler |
| `lib/api/index.ts` | Public barrel — `handleApiError` and the concrete in-memory limiter are deliberately not exported; routes configure rate limiting via options, never by importing a limiter directly |

### Files modified

| File | Change | Why |
|---|---|---|
| `app/api/leads/route.ts` | Refactored onto `withApiRoute`/`apiSuccess`/`parseJsonBody`/`ValidationApiError`; rate-limited at 10 req/min per IP | Proves the architecture on the one real route that exists; wire format verified unchanged (see above) |

**No existing UI file was touched.**

### Live verification (not just build-time)
- Curled all 4 response cases post-refactor — identical to pre-refactor
  output (new lead `201`, duplicate `200` with same lead id, validation
  errors `400` with the same field messages, malformed JSON `400`).
- Rate limiting: sent 11 rapid requests against the configured 10/60s
  limit — first 10 succeeded, 11th returned `429` with a `Retry-After`
  header and the expected error body.
- Logging: confirmed structured JSON lines on stdout for
  `request.start`/`request.complete` (with `requestId`, `status`,
  `durationMs`) and `request.handled_error` (`warn` level) for a
  validation failure.

### Future considerations
- Only one route exists to apply this architecture to. Campaign and
  Registration have repositories (Database Layer module) but no service
  layer yet, so no new routes were added here — building
  `POST /api/campaigns` before a `CampaignService` exists would either
  skip the service layer (inconsistent with the stated architecture) or
  require inventing business logic that wasn't asked for. The wrapper,
  response helpers, and DTO validator are already generic and ready for
  the next route once a service layer backs it.
- The in-memory rate limiter's per-instance limitation (see
  `lib/api/rateLimit/inMemory.ts`) matters once this deploys to more than
  one serverless instance — swap `inMemoryRateLimiter` for a Redis-backed
  `RateLimiter` implementation at that point; no route changes needed.
- No global security headers (CSP, `X-Frame-Options`, etc.) were added —
  that's `next.config.ts` scope (`ARCHITECTURE.md` §10.5, A05), not this
  module's.

---

## Database Layer (requested as "Module 3")

**Goal:** a production-ready, shared MongoDB architecture — repository
pattern, connection pooling, typed models, indexes, duplicate prevention,
migration-ready design, transaction-ready structure — covering four
models: Lead, Campaign, Registration, Audit Log.

**Note on numbering:** this request labeled itself "Module 3," which
already exists as the WhatsApp Provider Architecture. Rather than
renumber anything retroactively, this entry is titled by what it
actually is; both modules stand as built.

**Architecture decision — consolidation, not duplication.** Module 1
already built a working MongoDB-backed `Lead` repository with its own
cached connection. Giving Campaign/Registration/AuditLog their own
separate connection-caching code would have recreated the exact
"parallel implementation per feature" pattern flagged throughout
`ARCHITECTURE.md`. Instead: one shared `lib/db/` foundation (connection
pool, transaction helper, migration scaffold, generic repository-selection
factory), and Lead's existing MongoDB persistence was **migrated** onto
it. `leadService.ts`'s public behavior is unchanged — verified by
re-running Module 1's exact duplicate-prevention test against the
refactored code path (same result, same lead id preserved).

**Transaction-ready, concretely.** Every mongo repository write method
(`create`, `recordTouchpoint`, `updateStatus`) takes an optional
`session: ClientSession` parameter, so a future caller can compose
multiple writes into `runInTransaction()` — e.g. creating a Registration
while incrementing a Campaign's counter — without forcing every
single-document write through a transaction it doesn't need. This
required adding the same optional parameter to `LeadRepository`'s
interface (`lib/services/leads/types.ts`) — additive and backward
compatible, not a breaking change.

**Duplicate prevention, two layers.** Each entity that needs it has a
real MongoDB unique/compound index (the actual guarantee — enforced even
under concurrent requests, not just a check-then-insert race) *and* a
repository lookup method (`findByCode`, `findByLeadAndProgram`) that a
future service layer uses to decide policy (reject vs. return the
existing record) — the same split already established by Lead's
`findByPhoneOrEmail` + `leadService`'s dedup decision.

### Files created

**Shared foundation:**

| File | Why |
|---|---|
| `lib/db/connection.ts` | Shared, cached Mongoose connection with pooling config (`maxPoolSize: 10`, `minPoolSize: 0` — deliberately modest for serverless, where many function instances each hold their own pool) |
| `lib/db/transaction.ts` | `runInTransaction()` — wraps `mongoose.startSession()`/`withTransaction()` |
| `lib/db/types.ts` | `DuplicateKeyError` + `isDuplicateKeyError()` (wraps MongoDB's E11000), `AuditFields`, `SCHEMA_VERSION` |
| `lib/db/migrations/index.ts` | Real (if currently empty) migration runner — tracks applied migrations in a `_migrations` collection, runs each inside a transaction. Zero migrations registered yet: this is the initial schema, there's nothing to migrate from |
| `lib/db/repositories/types.ts` | Domain types + repository interfaces (ports) for Campaign, Registration, AuditLog — Lead's stays in `lib/services/leads/types.ts`, which predates this module |
| `lib/db/registry.ts` | The only file allowed to import a concrete `*.mongodb.repository.ts`. One generic `selectRepository()` helper + four cached getters (`getLeadRepository`, `getCampaignRepository`, `getRegistrationRepository`, `getAuditLogRepository`), each lazily importing its Mongo adapter so `mongoose` never loads unless MongoDB is actually configured |
| `lib/db/index.ts` | Public barrel — repository getters, domain types, `runInTransaction`, `DuplicateKeyError`. Never a model or a concrete repository |

**Models** (Mongoose schema + TS `Document` interface + `toX()` mapper + compiled model, each with field-level validators as a backstop behind application-level validation):

| File | Indexes | Duplicate prevention |
|---|---|---|
| `lib/db/models/lead.model.ts` | `{phone, email}` compound | Application-level (see Module 1) |
| `lib/db/models/campaign.model.ts` | `{code}` unique, `{status}`, `{utmCampaign}` | DB-level unique index on `code` |
| `lib/db/models/registration.model.ts` | `{leadId, programSlug}` unique compound, `{programSlug, status}` | DB-level unique compound index |
| `lib/db/models/auditLog.model.ts` | `{entityType, entityId}`, `{createdAt: -1}` | N/A — append-only log, `updatedAt` disabled |

**Repositories** (in-memory default + real MongoDB adapter, per entity — Lead's in-memory repository already existed and was left in place):

| File | Role |
|---|---|
| `lib/db/repositories/lead.mongodb.repository.ts` | Migrated from `lib/services/leads/repositories/mongodb.repository.ts` (deleted) — now on the shared connection, methods accept `session` |
| `lib/db/repositories/campaign.mongodb.repository.ts` / `campaign.inMemory.repository.ts` | `findByCode`, `create` (throws `DuplicateKeyError` on E11000), `listActive` |
| `lib/db/repositories/registration.mongodb.repository.ts` / `registration.inMemory.repository.ts` | `findByLeadAndProgram`, `create` (throws `DuplicateKeyError`), `updateStatus` |
| `lib/db/repositories/auditLog.mongodb.repository.ts` / `auditLog.inMemory.repository.ts` | `record`, `findByEntity` |

### Files modified

| File | Change | Why |
|---|---|---|
| `lib/services/leads/types.ts` | `LeadRepository`'s three methods gained an optional `session?: ClientSession` parameter | Transaction-ready, additive/non-breaking |
| `lib/services/leads/leadService.ts` | Now imports `getLeadRepository` from `@/lib/db` instead of the (now-deleted) local `./registry` | Points at the consolidated registry |
| `lib/services/leads/repositories/inMemory.repository.ts` | Comment only (stale path reference) — no functional change; TypeScript's structural typing already allowed fewer parameters than the interface | N/A |
| `config/database.ts` | Comment only (stale path reference) | N/A |

### Files deleted

| File | Superseded by |
|---|---|
| `lib/services/leads/registry.ts` | `lib/db/registry.ts` |
| `lib/services/leads/repositories/mongodb.schema.ts` | `lib/db/models/lead.model.ts` |
| `lib/services/leads/repositories/mongodb.repository.ts` | `lib/db/repositories/lead.mongodb.repository.ts` |

**No existing UI file was touched.**

### Future considerations
- Campaign, Registration, and AuditLog have repositories but no service
  layer yet (no `lib/services/campaigns/`, etc.) — same intentional gap
  as Module 1 had before `leadService` existed. A future service would
  import `getCampaignRepository()`/etc. from `@/lib/db` and own the
  business policy (what "duplicate" means, when to write an audit entry).
- Nothing currently writes to `AuditLogModel` — no call site exists yet.
  The natural first integration is `leadService.registerLead()` recording
  a `"lead.created"` / `"lead.duplicate_touched"` entry, deliberately not
  done here to keep this module's actual behavior change limited to the
  database layer itself.
- `runInTransaction()` has no caller yet — nothing currently spans more
  than one collection. The natural first use is a future Registration
  service atomically creating a Registration and touching its Campaign.
- The example migration in `lib/db/migrations/index.ts` is commented out
  on purpose — there is no schema to migrate from yet.

### QA — verified before this entry was written
- **TypeScript**: `npx tsc --noEmit` — zero errors across all 18 new
  files and the Lead migration.
- **ESLint**: `npm run lint` — 68 problems (17 errors, 51 warnings),
  identical to the pre-existing baseline; zero issues in any new or
  modified file.
- **Production build**: `npm run build` — succeeds, all 32 routes,
  `/api/leads` still dynamic.
- **Regression test**: re-ran Module 1's exact duplicate-prevention
  curl sequence against `POST /api/leads` after the Lead migration —
  identical result (new lead → `201`; resubmission → `200`,
  `duplicate: true`, same lead id, only `updatedAt` changed) — confirms
  moving Lead's persistence onto the shared `lib/db/` layer changed
  nothing observable about its behavior.
- **No existing UI touched**: confirmed via `git status` — the same 9
  UI files modified in earlier turns, none newly touched here.

---

## Wiring — site-wide `LeadForm` → `POST /api/leads`

**Goal:** connect Module 1's backend to a real, live form for the first
time — starting with the site-wide lead modal (`components/lead-modal/
LeadForm.tsx`), per explicit direction to start there.

**Design decision:** wired in as **additive, best-effort persistence**,
not a replacement for EmailJS. `MONGODB_URI` is not actually configured
in this environment, so replacing EmailJS outright would mean every lead
only lives in the in-memory store — lost on the next server restart or
redeploy, with no notification sent to anyone. EmailJS remains the
primary, user-facing success signal exactly as before; `/api/leads` is
fired concurrently and its failure is logged but never blocks or alters
the form's existing success/error state. Revisit dropping EmailJS once a
real `MONGODB_URI` is configured — that's a separate decision.

### Files created

| File | Why |
|---|---|
| `lib/services/leads/client.ts` | Browser-side `submitLead()` — a thin `fetch()` wrapper. Deliberately separate from `leadService.ts`/`registry.ts` (server-only, eventually touches Mongoose) so a client component can never accidentally pull server-only code into the browser bundle |

### Files modified

| File | Change | Why |
|---|---|---|
| `components/lead-modal/LeadForm.tsx` | `handleSubmit` now also calls `submitLead(...)`, fired concurrently with the existing `sendLeadEmail(...)` call and awaited only after it succeeds. Captures current UTM attribution via `getAttribution()` (Module 2) and maps it onto the payload | First real connection between the new backend and a live form; also the first practical use of Module 2's UTM persistence for something other than ad-platform events |

### Future considerations
- Not yet extended to `RegisterForm`, `ContactForm`, `InternshipApplyForm`,
  or either funnel's `RegistrationModal` — this was scoped to the
  site-wide `LeadForm` only, as directed. Each of those has its own
  `analytics.track(...)` call from Module 2 already in place at the same
  success point, so wiring `submitLead()` into them later is the same
  small addition repeated per file.
- Once a real `MONGODB_URI` is set and this has run in production for a
  while, revisit whether EmailJS should be dropped in favor of
  `/api/leads` being the sole path (with email notification triggered
  server-side from the route instead of client-side via EmailJS).
- Not live-tested end-to-end through the real EmailJS account (see QA
  below) — verified instead via independent endpoint testing (Module 1),
  a render check confirming zero console errors post-wiring, and a
  logical trace showing the new code cannot alter the existing
  success/error control flow.

---

## Module 1 — Lead Registration System

**Goal:** the first backend this app has ever had. Production-ready lead
capture: strict TypeScript, server-side validation, duplicate prevention,
a service layer, and a MongoDB-ready repository — built after Modules 2
and 3, since both were designed around a backend that didn't exist yet.

### Files created

| File | Why |
|---|---|
| `lib/services/leads/types.ts` | Domain types + the `LeadRepository` interface — the dependency-inversion boundary. `CreateLeadResult` is a discriminated union so validation failure is a normal return value, not a thrown exception |
| `lib/services/leads/validation.ts` | Server-side validation of the raw, untrusted request body — hand-rolled (matching the codebase's existing `lib/*/validation.ts` convention) rather than adding a schema library for something the codebase already has a pattern for |
| `config/database.ts` | `MONGODB_URI` / `IS_MONGODB_CONFIGURED` — server-only, gates which repository the registry selects |
| `lib/services/leads/repositories/inMemory.repository.ts` | Working default — leads held in a module-level array. What the app runs against with zero database setup |
| `lib/services/leads/repositories/mongodb.schema.ts` | Mongoose schema/model + a `toLead()` mapper so nothing outside this file ever touches a Mongoose document directly. Compound (non-unique) index on `phone`+`email` for dedup lookups |
| `lib/services/leads/repositories/mongodb.repository.ts` | Real Mongoose-backed adapter, using the standard cached-connection pattern for Next.js/serverless |
| `lib/services/leads/registry.ts` | Factory — the only file allowed to import a concrete repository. Loads the MongoDB adapter via **dynamic import**, so `mongoose` is never loaded at all on the in-memory path |
| `lib/services/leads/leadService.ts` | Application layer — `registerLead()`: validates, checks for an existing lead by phone/email, and either records a touchpoint on it or creates a new one. This is where duplicate prevention actually lives |
| `lib/services/leads/index.ts` | Public barrel — exports `leadService` + types only, same enforcement pattern as the analytics/whatsapp modules |
| `app/api/leads/route.ts` | `POST /api/leads` — the first API route in this codebase. `201` for a new lead, `200` for a recognized duplicate, `400` for validation errors, `500` for anything unexpected |

### Files modified

| File | Change | Why |
|---|---|---|
| `package.json` / `package-lock.json` | Added `mongoose` | Only new dependency this module needed — the MongoDB path is a real, working implementation, not a scaffold (unlike Module 3's vendor stubs, "MongoDB ready" was an explicit, non-deferred requirement) |
| `.env.local` | Added `MONGODB_URI`, blank | Leaving it unset runs the app against the in-memory repository — confirmed working via live testing below |

**No existing UI file was touched.** This module ships as pure backend;
wiring an existing form (register page, contact form, a funnel modal) to
`POST /api/leads` instead of — or alongside — its current direct EmailJS
call is a deliberate follow-up decision, not made here, so the live
EmailJS lead flow currently running in production is unaffected.

### Future considerations
- No spam/abuse protection yet (honeypot, rate limiting) — that's Phase
  0.4 in `ARCHITECTURE.md`'s roadmap, a distinct module, deliberately not
  folded into this one.
- No existing form calls this endpoint yet — see "no existing UI touched"
  above. The natural next step is wiring one form (start with the
  site-wide `LeadForm`) to call it in addition to, or instead of,
  EmailJS.
- `whatsappService.sendRegistrationConfirmation()` (Module 3) has no
  caller yet — `POST /api/leads` succeeding is the natural trigger point
  once that wiring decision is made.
- `npm install mongoose` surfaced 3 pre-existing vulnerabilities via
  `npm audit` — all three live in `next`/`postcss`/`sharp`, unrelated to
  mongoose (which added zero new advisories), and predate this session.
  Upgrading Next.js is a separate, higher-risk decision, out of scope
  here.

---

## Module 3 — WhatsApp Provider Architecture

**Goal:** an abstraction layer supporting Meta Cloud API, AiSensy,
Interakt, WATI, and Gallabox, with zero application code ever depending
on a specific vendor. No vendor integrated yet — scaffolding only.

### Files created

| File | Why |
|---|---|
| `lib/services/whatsapp/types.ts` | Domain types + the `WhatsAppProvider` interface — the dependency-inversion boundary every adapter implements and every consumer depends on |
| `lib/services/whatsapp/errors.ts` | `WhatsAppProviderNotImplementedError` — distinguishes "not wired up yet" from a normal send failure |
| `config/whatsapp.ts` | Env-driven provider selection (`WHATSAPP_PROVIDER`) + per-vendor credentials. Deliberately **not** `NEXT_PUBLIC_*` — WhatsApp credentials must stay server-only |
| `lib/services/whatsapp/providers/console.provider.ts` | Working default adapter — logs instead of sending, returns synthetic success. What the app actually runs against until a vendor is configured |
| `lib/services/whatsapp/providers/{metaCloudApi,aisensy,interakt,wati,gallabox}.provider.ts` | One structurally-complete stub per vendor — implements the interface, documents that vendor's real endpoint/auth/payload shape in comments, throws `WhatsAppProviderNotImplementedError` (no HTTP calls, no SDKs) |
| `lib/services/whatsapp/registry.ts` | Factory — the **only** file allowed to import a concrete adapter |
| `lib/services/whatsapp/whatsappService.ts` | Application layer — business-shaped methods (`sendRegistrationConfirmation`, `sendCohortReminder`, `sendPlainText`) instead of vendor operations |
| `lib/services/whatsapp/index.ts` | Public barrel — exports `whatsappService` + types only; adapters and the factory are deliberately unexported |

### Files modified

| File | Change | Why |
|---|---|---|
| `.env.local` | Added 10 blank `WHATSAPP_*` variable placeholders | Documents the config surface without requiring any credential to exist yet |

### Future considerations
- Not wired into the app yet — there's no backend route to call it from
  until Module 1 (lead/registration persistence) exists. Intended first
  call site: a future `/api/register` handler, right after a lead is
  persisted.
- Each vendor's comment block is an illustrative sketch based on general
  documented patterns, not a verified contract — re-check exact field
  names against that vendor's current docs before writing the real
  implementation.
- Inbound webhook handling (delivery status, replies) is out of scope
  here by design — it has no consumer yet and would be speculative code;
  revisit when `/api/webhooks/whatsapp` is actually built.

---

## Module 2 — Meta Pixel + Google Analytics + UTM Tracking

**Goal:** provider-abstracted analytics covering PageView, Lead,
CompleteRegistration, button clicks, and scroll depth, with UTM
first-touch/last-touch persistence.

### Files created

| File | Why |
|---|---|
| `lib/services/analytics/types.ts` | Canonical event vocabulary (`PageView \| Lead \| CompleteRegistration \| ButtonClick \| ScrollDepth`) + `AnalyticsProvider` interface |
| `lib/services/analytics/global.d.ts` | Ambient `window.gtag`/`window.fbq`/`window.dataLayer` typings, required for strict-mode compilation |
| `config/analytics.ts` | `NEXT_PUBLIC_GA_MEASUREMENT_ID` / `NEXT_PUBLIC_META_PIXEL_ID` — public by necessity, since both scripts run client-side |
| `lib/services/analytics/providers/ga4.provider.ts` | GA4 adapter — maps canonical events to GA4's recommended event names (`Lead` → `generate_lead`, `CompleteRegistration` → `sign_up`, etc.) |
| `lib/services/analytics/providers/metaPixel.provider.ts` | Meta Pixel adapter — routes `PageView`/`Lead`/`CompleteRegistration` through `fbq('track', ...)` (Meta's standard events) and everything else through `fbq('trackCustom', ...)` |
| `lib/services/analytics/utm.ts` | First-touch (set once) + last-touch (overwritten per new tracking params) attribution, persisted in a first-party cookie, 30-day expiry |
| `lib/services/analytics/index.ts` | Public entry point (`analytics.track`/`analytics.pageview`/`analytics.trackClick`) — fans out to every registered provider, auto-enriches events with current UTM attribution |
| `lib/services/analytics/useScrollDepth.ts` | Fires `ScrollDepth` once per threshold (25/50/75/100%) per page view |
| `lib/services/analytics/useTrackClick.ts` | Stable `trackClick(label, location)` hook — lets any existing button adopt click tracking via one `onClick` line |
| `components/analytics/AnalyticsScripts.tsx` | Loads `gtag.js`/`fbevents.js` via `next/script` (`afterInteractive`), each entirely omitted when its ID isn't configured |
| `components/analytics/PageViewTracker.tsx` | Fires `PageView` + UTM capture on every client-side route change (App Router navigations that script auto-pageview logic doesn't see) |
| `components/analytics/ScrollDepthTracker.tsx` | Mounts scroll-depth tracking globally, keyed by pathname so thresholds reset per page |
| `components/analytics/index.ts` | Barrel export |

### Files modified

| File | Change | Why |
|---|---|---|
| `app/layout.tsx` | Mounted `AnalyticsScripts`, `PageViewTracker` (in `Suspense`), `ScrollDepthTracker` | Single global wiring point; all three render `null`/script tags — no visual change |
| `components/lead-modal/LeadForm.tsx` | `analytics.track('Lead', ...)` after successful submit | Site-wide lead modal — the "canonical" lead-capture surface |
| `components/RegisterForm.tsx` | `analytics.track('CompleteRegistration', ...)` after successful submit | `/register` is a full program registration, not a low-commitment lead |
| `components/ContactForm.tsx` | `analytics.track('Lead', ...)` in both `ContactForm` and `CallbackForm` success handlers | Two distinct forms in one file, both lead-capture |
| `components/InternshipApplyForm.tsx` | `analytics.track('Lead', ...)` before `setSubmitted(true)` | Consistent with other lead-capture forms, even though this form's own backend wiring is still a pre-existing TODO |
| `components/ai-bootcamp/RegistrationModal.tsx` | `analytics.track('CompleteRegistration', ...)` after successful send | Funnel registration = registration completion, not a generic lead |
| `components/ai-generalist/RegistrationModal.tsx` | Same as above | Mirrors `ai-bootcamp`'s funnel structure |
| `components/ui/WhatsAppButton.tsx` | `onClick` → `analytics.trackClick('whatsapp_float', ...)` | Demonstrates `ButtonClick` tracking on the highest-traffic CTA on the site |
| `components/Navbar.tsx` | `onClick` → `trackClick('enroll_now', ...)` on both desktop and mobile "Enroll Now" links | Second `ButtonClick` demonstration; `useTrackClick()` hook wired at component top |
| `.env.local` | Added `NEXT_PUBLIC_GA_MEASUREMENT_ID` / `NEXT_PUBLIC_META_PIXEL_ID`, blank | Both providers no-op until filled in — confirmed via live network check that no script loads while unset |

### Future considerations
- Server-side Meta CAPI (recommended for ad-blocker resilience) is not
  wired — it needs a backend endpoint, which doesn't exist until Module 1
  lands.
- Click tracking is demonstrated on 3 CTAs (WhatsApp float, Navbar
  desktop/mobile "Enroll Now") as a proof of the pattern, not applied
  site-wide — extending it to any other button is a one-line `onClick`
  addition via `useTrackClick()`.

---

## QA — Modules 1–3, verified before this changelog was written

- **TypeScript**: `npx tsc --noEmit` — zero errors, including Module 1's
  Mongoose global-augmentation code.
- **ESLint**: `npm run lint` — zero net-new errors or warnings across all
  three modules (68 problems / 17 errors / 51 warnings both before and
  after Module 1 — one self-inflicted warning from an unnecessary
  `eslint-disable` comment was introduced and immediately removed). The
  repo's 17 pre-existing errors (in `CustomCursor.tsx`, `SpotlightGlow.tsx`,
  `SuccessScreen.tsx`, `TiltCard.tsx`, `RegisterForm.tsx`'s unrelated
  `<a>`/component-in-render issues, etc.) were cross-checked by exact line
  number against every module's diff hunks and confirmed to predate all
  of this work.
- **Production build**: `npm run build` — succeeds, all 32 routes
  generated (31 pre-existing + the new `/api/leads` route, correctly
  marked dynamic/server-rendered rather than static).
- **Module 1 endpoint testing** (live, against the production build):
  - Empty body → `400`, one field error per missing required field
  - Invalid phone number → `400`, phone-specific error message
  - Valid new lead → `201`, `duplicate: false`, phone normalized to
    `+91XXXXXXXXXX`, UUID assigned, `status: "new"`
  - Same lead resubmitted with a different `source` → `200`,
    `duplicate: true`, **same lead id** as the first request, only
    `updatedAt` changed — confirms dedup updates the existing record
    rather than silently faking success or creating a second row
  - Malformed JSON body → `400`, root-level parse error, no unhandled
    exception
  - `npm audit` after installing `mongoose`: 3 vulnerabilities, all
    pre-existing in `next`/`postcss`/`sharp`, zero attributable to
    `mongoose` itself.
- **Runtime/hydration**: production server started locally; `/`,
  `/programs`, `/register`, `/ai-bootcamp` (incl. its registration
  modal), and `/contact` were loaded in a real browser with console
  tracking active — zero console errors or warnings, zero hydration
  mismatches.
- **Network behavior**: confirmed zero requests to
  `gtag`/`fbevents`/`googletagmanager`/`facebook` while
  `NEXT_PUBLIC_GA_MEASUREMENT_ID`/`NEXT_PUBLIC_META_PIXEL_ID` are unset —
  the "omit entirely when unconfigured" design works as intended, not
  just in theory.
- **No breaking changes**: `git diff --stat` — 9 files touched, 31
  insertions, 0 deletions. Every change is additive.
- **No duplicate code**: all 6 WhatsApp provider stubs and both
  analytics provider adapters have unique file checksums.
- **No new dependencies**: `package.json`/`package-lock.json` diff is
  empty across both modules.
- **Not exercised live**: form submission through the real, configured
  EmailJS account was intentionally not triggered during QA (would send
  real test data through the client's live email account) — the
  `analytics.track(...)` call sites were instead verified by static
  review and by confirming the analytics layer never throws when
  providers are unconfigured (proven by the network check above).

---

## QA — LeadForm wiring, verified before this entry was written

- **TypeScript**: `npx tsc --noEmit` — zero errors.
- **ESLint**: `npm run lint` — 68 problems (17 errors, 51 warnings),
  identical to the pre-existing baseline. `LeadForm.tsx`'s one warning
  (`'closeModal' is assigned a value but never used`) is pre-existing,
  confirmed present before this session under the same message. Zero
  issues in the new `lib/services/leads/client.ts`.
- **Production build**: `npm run build` — succeeds, all 32 routes.
- **Runtime**: production server started locally; the site-wide lead
  modal was opened via its real trigger (the homepage hero's "Reserve
  Your Free Demo" button) — renders identically to before, zero console
  errors on mount.
- **Not exercised**: an actual form submission through the live,
  configured EmailJS account — see "Future considerations" above for
  why, and what was verified instead.

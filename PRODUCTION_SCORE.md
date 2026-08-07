# Production Readiness Score — Post RC-1

**Status: HISTORICAL.** "RC-1" here means the pre-blueprint
stabilization pass documented in `RC_FIX_REPORT.md` — unrelated to the
later "RC-1 — Authentication & Identity" that opens the Production
Hardening Release Candidate track (RC-1 through RC-7). This score is
frozen at that earlier point in the project and does not reflect the
codebase's current state — see `RC_7_AUDIT.md` and `docs/README.md`
for the current production-readiness picture.

Companion to `RC_FIX_REPORT.md` (per-issue detail) and `CHANGELOG.md`'s
old "RC-1 — Release Candidate Stabilization" entry (narrative, near the
bottom of that file — not the "RC-1 — Authentication & Identity" entry
near the top). This is the updated scorecard and the final launch
decision, re-scored after every Critical and High priority issue from
the prior Release Candidate audit and End-to-End Journey Audit was
addressed.

---

## Remaining issues, by priority

### 🔴 Critical

**None.** Every Critical issue identified in the prior audit is
resolved — see `RC_FIX_REPORT.md` items 1–6. This is a factual claim,
not a marketing one: it's backed by a live-verified end-to-end chain
(Lead → CRM → Audit Log → Automation → Registration → WhatsApp →
Analytics, exercised over real HTTP against a running server) and a
passing automated test suite, not just a read of the code.

### 🟠 High

- **Rate limiter is still per-process, in-memory.** Honestly documented
  in the code as a known limitation since it was first built — on a
  multi-instance serverless deployment, the effective global rate limit
  becomes *configured limit × instance count*. Fixing this properly
  means provisioning a distributed store (Redis/Upstash) — an
  infrastructure decision, not a code change, and out of scope for a
  stabilization pass. The interface (`RateLimiter`) is already designed
  for a drop-in swap when that infra exists.
- **No error tracking or APM.** Structured logs exist (`lib/logger.ts`)
  but nothing pushes an alert when something breaks in production —
  someone has to be actively tailing logs. Needs a Sentry (or
  equivalent) account and DSN, a real infra/vendor decision this pass
  didn't have the authority to make unilaterally.
- **No unified API reference.** Two excellent architecture documents
  exist for two subsystems (WhatsApp, Campaign Manager) plus this
  pass's own fix report, but no single OpenAPI-style reference covers
  the full set of ~20+ admin routes consistently. A real but mechanical
  gap — deferred for time, not difficulty.
- **`POST /api/leads` and `POST /api/registrations` remain
  unauthenticated public routes.** Pre-existing, already flagged in
  both routes' own doc comments before this pass. A real fix means
  deciding how public write routes get protected (CSRF token, origin
  check, rate-limit-only-by-design, or otherwise) — a design decision
  affecting both routes together, not a bolt-on to either individually.

### 🟡 Medium

- **No self-service (email-based) password reset for admin accounts** —
  only the CLI script added this pass (`scripts/resetAdminPassword.ts`),
  which requires shell/deploy access. Real self-service needs a
  transactional email provider this app doesn't have configured
  anywhere; see `RC_FIX_REPORT.md` item 16 for the full reasoning.
- **No documented backup/disaster-recovery runbook** for MongoDB once
  it's actually configured in production.
- **Content placeholders remain on public pages** — TODO-marked
  placeholder avatars on `/about` and `/placements`, and unverified
  salary/market claims flagged with TODOs in `lib/blog-posts.ts`. These
  are content-accuracy items for the content owner, not engineering
  fixes; nothing here should be fabricated by an engineering pass.
- **Admin sidebar still doesn't collapse on mobile** — a real UX gap on
  narrow viewports, explicitly out of scope for this pass ("do not
  redesign the UI").
- **Two `npm audit` advisories remain** (`postcss`, `sharp`) — both
  bundled inside Next.js's own dependency tree, not this app's; see
  `RC_FIX_REPORT.md` item 11. Will resolve when a future Next.js
  release bumps its own bundled versions.

### 🟢 Low

- The Hero CTA modal's CRM write is still best-effort/fire-and-forget
  by original design — a failure is only `console.error`'d, no
  retry/alert. Lower risk than before this pass (it's now one of eight
  forms with this property instead of the only one that reached the
  backend at all), but still worth a real retry/alerting mechanism
  eventually.
- No unit-test layer under the new E2E smoke suite (service-layer logic
  like retry/backoff math isn't directly unit-tested, only exercised
  indirectly through the smoke suite and this session's earlier manual
  verification).

---

## Scorecard

| Dimension | Before RC-1 | After RC-1 | What moved it |
|---|---|---|---|
| Architecture | 88 | 88 | Unchanged by design — no architecture changes made |
| Code Quality | 85 | 90 | A real bug fixed (item 10), duplicate submission logic across 7 forms consolidated into one hook, lint errors 17→10 |
| UI / UX | 78 | 85 | Forms now give truthful success/error states tied to real backend results; the RegisterForm data-loss bug is fixed |
| Responsiveness | 74 | 74 | Unchanged — out of scope this pass |
| Performance | 80 | 80 | Unchanged — no perf-relevant changes made |
| Security | 62 | 80 | Security headers added, Next.js CVE patched, password-reset gap closed, CSP verified live; rate limiter/APM gaps remain (High, not Critical) |
| Accessibility | 82 | 82 | Unchanged — out of scope this pass |
| SEO | 75 | 75 | Unchanged |
| Scalability | 70 | 72 | Message-tracking now unified across both WhatsApp send paths; per-process rate limiter remains the real constraint |
| Maintainability | 87 | 91 | CI pipeline now exists; duplicate logic consolidated; stale doc comment fixed |
| Documentation | 72 | 83 | `.env.example`, `RC_FIX_REPORT.md`, updated `CHANGELOG.md`; unified API reference still missing |
| **Overall Production Readiness** | **54** | **80** | Gated score — see below |

The overall figure is still not a plain average — it's gated by the
worst unresolved category, same methodology as the prior audit. Every
Critical is resolved, which is what allows the overall score to move
out of the 50s at all; it's capped in the low 80s rather than higher by
the remaining Highs (distributed rate limiting, error tracking/APM,
unauthenticated public write routes) — real operational gaps for a
product actually taking live traffic at scale, even though none of them
represents silent data loss or a broken core flow anymore.

---

## Final decision

**⚠ READY FOR PRODUCTION AFTER MINOR FIXES**

Not a plain "✅ READY," and the difference is specific: this app can now
safely take real traffic without silently losing data or leaving its
own CRM disconnected from the site — that was the actual launch
blocker, and it's resolved, verified live, and protected by a test
suite that catches a regression of the same class automatically. What
remains (a distributed rate limiter, error tracking, self-service
password reset, an authorization story for two public write routes) are
real, worth doing soon, and none of them will cause silent failure or
data loss the way the prior Critical issues would have. They're
operational maturity gaps for a product running at real scale and
duration, not correctness gaps in what the product does today.

If this were being launched this week: ship it, with the four
remaining High items on the very next sprint, in roughly this order —
(1) decide and implement authorization for `/api/leads` and
`/api/registrations`, since that's the one remaining item touching the
same "is data actually safe" category as everything fixed this pass;
(2) error tracking, since without it the next regression of this kind
won't announce itself even with the new test suite running in CI (CI
catches it before merge, not a live incident after); (3) a distributed
rate limiter once real traffic volume justifies it; (4) an OpenAPI
reference, whenever the API surface next needs onboarding a second
engineer.

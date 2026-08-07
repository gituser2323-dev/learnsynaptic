# Environment Variable Reference

**Status: current, and this is deliberately not a second copy of the
same data.** The authoritative, variable-by-variable reference is
**[`.env.example`](../../.env.example)** in the repo root — every real
variable this codebase reads, with its own purpose, required/optional
tier, and a safe placeholder, verified in sync with actual
`process.env.*` usage across the codebase as of RC-8 (2026-08-05):
every variable used in `app/`, `lib/`, `config/`, `scripts/`, and
`middleware.ts` appears in `.env.example`, with the sole exceptions of
`NODE_ENV`/`VERCEL_ENV` (set automatically by the platform, never by a
developer) — documented in `.env.example`'s own closing section.

This page explains the classification system `.env.example` uses and
points you at the right section — it does not restate every variable,
which would immediately drift out of sync with the real file.

---

## 1 · Classification tags used throughout `.env.example`

| Tag | Meaning |
|---|---|
| `[REQUIRED]` | Production degrades to something unsafe or non-functional without it. `lib/startupValidation.ts` logs a loud startup error for every one of these when `NODE_ENV=production` and it's unset. |
| `[RECOMMENDED]` | Fails **closed** already (the feature stays fully inert, never insecure) — an availability gap, not a security one. |
| `[PLATFORM]` | One value for the whole deployment — never stored per-tenant, never entered by a customer. |
| `[TENANT-AWARE]` | A platform-wide default/fallback. Any organization can override it with its own credential via Settings → Integrations (Module 8.2) — never required globally just because one tenant wants it connected. |
| `[PUBLIC]` | `NEXT_PUBLIC_*` — reaches the browser bundle by design. Never a real secret. |
| `[OPTIONAL]` | The feature it backs degrades gracefully when unset — not a deployment blocker at any tier. |

## 2 · Sections, at a glance

| `.env.example` section | Covers |
|---|---|
| Database | `MONGODB_URI` |
| Authentication — platform secrets | JWT secrets, cookie config, password reset/MFA/lockout tuning, Social Login OAuth, team-invitation TTL, verification-link base URL |
| Encryption-at-rest secrets | 4 separate AES-256-GCM keys (tenant credentials, webhook secrets, calendar tokens, MFA secrets) — never share one value across two purposes |
| Platform-only admin routes | `PLATFORM_ADMIN_SECRET` (global Plan-catalog write gate — distinct from RC-6's `platformRole`, see [`docs/user-guides/platform-admin.md`](../user-guides/platform-admin.md)) |
| Scheduled jobs / queue | `CRON_SECRET` |
| Disaster recovery | `MAINTENANCE_READ_ONLY_MODE` |
| Observability | Error tracking provider/webhook, audit log retention |
| File storage | `STORAGE_PROVIDER` + AWS S3 / Cloudinary credentials, virus scanning |
| WhatsApp Cloud API | Provider selection, Meta Cloud API platform credentials, alternate providers, Embedded Signup Meta App config, campaign CSV cap |
| Email channel | Provider selection, Postmark credentials, inbound webhook token |
| AI CRM | Provider selection, OpenAI/Anthropic/Gemini keys |
| Calendar & Meeting Connectors | Google/Microsoft/Zoom OAuth apps (separate from Social Login's own OAuth apps — different consent screen/scope/redirect URI) |
| Payments | Razorpay/Stripe/Cashfree keys, PhonePe/PayPal scaffold placeholders |
| Marketing Dashboard | Meta Ads, Google Analytics |
| Public frontend configuration | `NEXT_PUBLIC_*` — GA4/Meta Pixel ids, site URL, EmailJS |

## 3 · Zero-config local development

The app runs with **nothing set** in `.env.local` — see
[`local-development.md`](local-development.md). Every `[REQUIRED]`
tier only actually enforces (loud startup warning) when
`NODE_ENV=production`; local dev and CI both run with in-memory
repositories, a per-process JWT secret, and no-op providers by design.

## 4 · Environment tiers (local / staging / production)

Covered by `.env.example`'s own top-of-file "Environments" section and
expanded operationally in
[`docs/deployment/staging.md`](../deployment/staging.md) and
[`RUNBOOK.md`](../../RUNBOOK.md) — not repeated a third time here.

## 5 · Keeping this in sync

`.env.example` is the single source of truth. If you add a new
`process.env.X` reference anywhere in the codebase, add the matching
line to `.env.example` in the same change — this was verified
line-by-line against real `process.env.*` usage as part of RC-8 and
found genuinely in sync (two real gaps, `APP_BASE_URL` and
`TEAM_INVITATION_TTL_SECONDS`, were found missing and added during this
pass).

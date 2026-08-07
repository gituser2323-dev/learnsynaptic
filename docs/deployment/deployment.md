# Deployment Guide

**Status: current.** The day-to-day deploy mechanics (CI, push-to-deploy,
migrations, rollback, health checks) already live in
**[`RUNBOOK.md`](../../RUNBOOK.md)** — this page does not repeat them.
What follows is what `RUNBOOK.md` doesn't cover: the pre-deploy
external-configuration checklist (domains, HTTPS, webhook URLs, OAuth
callbacks) that only needs doing once per environment, consolidated
from where it's otherwise scattered across `.env.example` and several
integration-specific docs.

---

## 1 · What RUNBOOK.md already covers (not repeated here)

| Topic | Section |
|---|---|
| Architecture map, why Vercel, why not Docker/Kubernetes | `RUNBOOK.md` §1–3 |
| Environments (local/staging/production) | `RUNBOOK.md` §4 |
| The actual deploy steps (CI, push, migrate, sync-indexes) | `RUNBOOK.md` §5 |
| Database migrations | `RUNBOOK.md` §6, and [`docs/development/migrations.md`](../development/migrations.md) |
| Database connection behavior | `RUNBOOK.md` §7 |
| Health/readiness/preflight verification | `RUNBOOK.md` §8 |
| Queue/DLQ monitoring | `RUNBOOK.md` §9 |
| Rollback | `RUNBOOK.md` §10 |
| Common failures | `RUNBOOK.md` §11 |

## 2 · Web deployment

Vercel serverless functions (`app/api/**`), Edge runtime for
`middleware.ts`. See [ADR-0004](../development/adr/0004-vercel-serverless-deployment.md)
for why. No separate build step beyond `next build` — Vercel's own
pipeline is the deployment artifact.

## 3 · Worker deployment

**There is no separate worker to deploy.** Background job execution
happens inside the same serverless functions, triggered by Vercel Cron
— see [ADR-0003](../development/adr/0003-queue-architecture.md) and
[`docs/integrations/automation.md`](../integrations/automation.md#6--queue-retry-dlq).

## 4 · Database

A real MongoDB deployment (e.g. Atlas) — `MONGODB_URI`. See
[`docs/development/environment.md`](../development/environment.md)
and `RUNBOOK.md` §6–§7. **A production deployment's own automated
backup configuration (Atlas Cloud Backup, PITR, retention) is not
something this codebase can configure for you** — see
[`DR_RUNBOOK.md`](../../DR_RUNBOOK.md) for what's built (tooling,
drill procedure) vs. what REQUIRES PRODUCTION PROVIDER CONFIGURATION.

## 5 · Queue / Cron

`vercel.json`'s cron entry hits `/api/cron/run-due-jobs` on a schedule,
`CRON_SECRET`-authenticated. Nothing else to provision.

## 6 · Storage

Set `STORAGE_PROVIDER` to `aws_s3` or `cloudinary` before accepting
real file uploads — `local` is dev-only and not production-safe on
Vercel (§4 of [ADR-0004](../development/adr/0004-vercel-serverless-deployment.md)).

## 7 · Observability

`ERROR_TRACKING_PROVIDER=webhook` + `ERROR_TRACKING_WEBHOOK_URL`
pointed at a real collector — see
[`docs/development/environment.md`](../development/environment.md).
Unset is safe (errors still reach structured stdout/stderr logs) but
not forwarded anywhere external.

## 8 · Domains & HTTPS

- `NEXT_PUBLIC_SITE_URL` and `APP_BASE_URL` should both point at the
  real environment's own domain (never assume `localhost` — see each
  variable's own note in `.env.example`). `NEXT_PUBLIC_SITE_URL` drives
  `robots.txt`/`sitemap.xml`/`metadataBase`/JSON-LD; `APP_BASE_URL`
  drives every verification-email and team-invitation link.
- HTTPS is enforced via `Strict-Transport-Security` (harmless over
  plain HTTP in local dev — the browser only enforces HSTS over
  HTTPS). Vercel provisions TLS automatically for both the default
  `*.vercel.app` domain and any custom domain you attach.

## 9 · Webhook URLs to register with each provider

Every inbound webhook route is a fixed path — register
`https://<your-domain>/api/webhooks/whatsapp`,
`https://<your-domain>/api/webhooks/email`, and
`https://<your-domain>/api/webhooks/payments/<provider>` with the
respective vendor dashboard (Meta App, Postmark Inbound Stream,
Razorpay/Stripe/Cashfree dashboard) for the environment you're
configuring — **staging and production must use different registered
URLs**, pointed at each environment's own domain, never one webhook
URL shared across both. See [`staging.md`](staging.md) for why this
matters concretely.

## 10 · OAuth callback URLs to register

Four **separate** OAuth app families exist in this codebase, each with
its own callback URL to register — do not conflate them (a
mismatched app config is a real, common misconfiguration):

| OAuth app family | Callback URL pattern | Registered against |
|---|---|---|
| Social Login (RC-1) | `https://<domain>/api/auth/oauth/{google\|microsoft\|github}/callback` | Each vendor's own separate consent screen for "log in to LearnSynaptic" |
| Calendar Connectors (Module 6.3) | Configured per vendor via `GOOGLE_OAUTH_REDIRECT_URI`/`MICROSOFT_OAUTH_REDIRECT_URI`/`ZOOM_OAUTH_REDIRECT_URI` | A **separate** OAuth app per vendor from Social Login above — different consent screen, different scope |
| WhatsApp Embedded Signup (Module 8.5) | No traditional redirect URI — a Facebook Login for Business popup handshake | See [`WHATSAPP_EMBEDDED_SIGNUP.md`](../../WHATSAPP_EMBEDDED_SIGNUP.md) for the exact Meta App Dashboard setup |
| Integrations OAuth (generic, `[providerId]/oauth/authorize`) | `https://<domain>/api/admin/integrations/[providerId]/oauth/callback` | Whichever provider's own OAuth app config, per the specific integration |

Every redirect URI must **exactly** match what's registered on the
vendor's own console — this is checked by the vendor, not this app;
a mismatch fails at the vendor's own authorization step, before this
app's callback route is ever reached.

## 11 · Pre-launch checklist

- [ ] Every `[REQUIRED]` variable in `.env.example` set to a real,
      environment-specific value (never copy-pasted from another
      environment — see [`staging.md`](staging.md))
- [ ] `STORAGE_PROVIDER` is `aws_s3` or `cloudinary`, not `local`
- [ ] `npm run db:migrate` and `npm run db:sync-indexes` run after the
      first deploy
- [ ] Every webhook URL (§9) and OAuth callback (§10) this
      environment actually uses is registered against the vendor
      dashboard, pointed at this environment's own domain
- [ ] `npm run preflight` reports every configured integration as
      healthy
- [ ] Real MongoDB backup configured at the provider level (Atlas
      Cloud Backup or equivalent) — see [`DR_RUNBOOK.md`](../../DR_RUNBOOK.md)

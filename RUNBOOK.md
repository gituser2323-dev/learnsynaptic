# LearnSynaptic — Production Runbook

RC-4 (Deployment & Production Infrastructure). Operational reference
for deploying, operating, and recovering this application — no real
secrets appear anywhere in this file; every example value below is a
placeholder.

---

## 1 · Architecture map

```
Browser
  │
  ▼
Application (Next.js 16, App Router, Vercel serverless functions)
  │
  ▼
Database (MongoDB — Mongoose, one cached connection pool per instance)
  │
  ▼
Queue (MongoDB-backed ScheduledJob collection — NOT Redis/BullMQ)
  │
  ▼
Cron (Vercel Cron → GET /api/cron/run-due-jobs, every 5 minutes)
  │
  ▼
External Providers (WhatsApp/Meta, Email/Postmark, AI, Payments,
                     Calendar OAuth, Storage, Webhook notifications)
  │
  ▼
Storage (AWS S3 / Cloudinary — never the local filesystem in production)
  │
  ▼
Observability (structured stdout/stderr logs + optional webhook-based
                error tracking — see config/errorTracking.ts)
```

There is no separate worker process, no Redis, no message broker. The
"queue" is real MongoDB documents (`ScheduledJob`), and the "worker" is
Vercel's own serverless function invoked on a schedule by Vercel Cron.
This was a deliberate architecture decision (RC-3), re-verified during
RC-4's own audit — see §3 below before ever introducing either.

---

## 2 · Deployment target: Vercel

This app is built and configured for Vercel:

- `vercel.json` declares the cron schedule Vercel's own platform reads
  and triggers directly — no external cron service needed.
- `next.config.ts`'s security headers, `middleware.ts`'s Edge runtime
  split, and every API route's own `withApiRoute()` wrapper all assume
  a serverless request/response model (no persistent in-process state
  beyond the cached MongoDB connection — see §7).
- Every outbound provider call has an explicit timeout
  (`lib/net/timeouts.ts`) and every meaningfully-bulk route declares an
  explicit `maxDuration` (RC-4) — both assume a bounded-duration
  serverless function, not a long-running process.

**Do not migrate away from Vercel without a concrete, demonstrated
incompatibility.** None was found during RC-4's own audit.

---

## 3 · Why not Docker / Kubernetes

**Docker: not used, and not needed for the web application.** Vercel
builds and runs this Next.js app directly from the repository — there
is no container to build, ship, or version for the web tier. The ONE
scenario that would justify a Dockerfile is a persistent worker process
this app doesn't have (see below) — introducing one *merely to look
more "enterprise"* would be exactly the kind of technical debt this
mission's own instructions explicitly warn against ("Do NOT add
infrastructure merely because it is considered enterprise").

**Kubernetes: not used, and not justified at this app's actual scale.**
K8s solves problems this deployment doesn't have: orchestrating many
long-running containers, custom autoscaling policies, multi-service
service-mesh networking. This app is one Next.js application on Vercel
plus a handful of `npm run`-invoked one-off scripts (migrations, index
sync, preflight) — introducing a cluster to run that would be pure
operational overhead with no corresponding benefit.

**When would this change?** Only if a future module genuinely needs a
persistent, always-running process Vercel's serverless model can't
provide (e.g. a long-lived WebSocket server, a CPU-bound job that
can't fit in any serverless function's duration ceiling even after
being decomposed). RC-3's own reliability work evaluated exactly this
question for the job queue specifically and found the existing
MongoDB-backed scheduler + Vercel Cron combination already sufficient
— re-evaluate if that changes, don't introduce either preemptively.

---

## 4 · Environments

| Tier | Database | Secrets | OAuth callback / webhook URLs |
|---|---|---|---|
| **Local** | in-memory (unset `MONGODB_URI`) or a local `mongod` | blank is fine — every secret has a dev fallback | `http://localhost:3000/...` |
| **Staging** | its own MongoDB database, never production's | its own unique `JWT_ACCESS_TOKEN_SECRET`/encryption secrets/`CRON_SECRET` — never copied from production | registered against the staging domain |
| **Production** | production MongoDB (Atlas or equivalent) | every `[REQUIRED]` var in `.env.example` set to a real, unique value | registered against the production domain |

**Staging-specific safety notes (RC-4 — Production Safety Switches):**

- Leave `WHATSAPP_PROVIDER`/`EMAIL_PROVIDER` at their safe `console`
  default on staging unless a vendor **sandbox** account exists — never
  point staging at a real, customer-facing WhatsApp number or email
  sender. `lib/startupValidation.ts`'s `checkPreviewEnvironmentSafety()`
  logs a loud warning automatically if a Vercel **preview** deployment
  (`VERCEL_ENV=preview`, which Vercel sets automatically — no
  configuration needed) has a real provider active; treat that warning
  as a real incident, not noise.
- Payments: a payment provider only fires once its `IntegrationConnection`
  is BOTH connected AND enabled via Settings → Integrations, on top of
  having real env credentials — a staging deployment that never clicks
  "Connect" stays fully inert for payments regardless of what's in its
  `.env`, a real safety property worth relying on deliberately (never
  click "Connect" on a real vendor account from staging).
- Run `npm run preflight` against a staging deployment's own env before
  treating it as "ready" — the same check production uses (§8).

---

## 5 · Deploying

1. **CI must pass first** — `.github/workflows/ci.yml` runs
   type-check, lint, unit tests, a production build, and an E2E smoke
   suite on every push/PR to `main`; a separate `dependency-audit` job
   runs `npm audit --audit-level=high`. Do not deploy a build that
   failed any of these.
2. **Push to `main`** (or merge the PR) — Vercel deploys automatically
   from the connected GitHub repository.
3. **After a schema-affecting deploy**, run the two operator-triggered
   steps that deliberately do NOT run automatically on boot (RC-4 —
   the mission's own explicit "do NOT automatically create destructive
   indexes/migrations during every production boot" instruction):
   ```
   npm run db:migrate        # applies any new entries in lib/db/migrations/
   npm run db:sync-indexes   # creates/drops indexes to match the current schema
   ```
   Both are idempotent — safe to run even when there's nothing new to
   do. `autoIndex` is automatically disabled when `NODE_ENV=production`
   (see `lib/db/connection.ts`), so `db:sync-indexes` is the *only*
   thing that actually applies a new/changed index in production.
4. **Verify** — see §8 below.

---

## 6 · Database migrations

`lib/db/migrations/index.ts` holds an explicit, ordered `migrations`
array. Each entry:
- Runs **at most once** — applied ids are recorded in a `_migrations`
  collection; already-applied migrations are skipped, not re-run.
- Runs inside a MongoDB transaction — a failure partway through never
  leaves data half-migrated.

To add one: append a `{ id, description, up }` entry (see the file's
own example shape), commit it, deploy, then run `npm run db:migrate`
manually — never wired to run automatically at boot (deliberate
separation of APPLICATION STARTUP from DATA MIGRATION, per this
mission's own instruction).

---

## 7 · Database connection behavior

- One cached Mongoose connection (with its own internal pool,
  `maxPoolSize:10`/`minPoolSize:0`) per warm serverless instance —
  reused across invocations, not reopened per request.
- **RC-4 fix**: a failed connection attempt no longer poisons that
  cache forever — the next call retries a fresh connection rather than
  replaying the same rejection indefinitely (see `lib/db/connection.ts`'s
  own doc comment for the bug this closed).
- `autoIndex` is disabled in production — see §5 step 3.

---

## 8 · Health, readiness, and preflight verification

```
GET /api/health          # pure liveness — process is up, never touches the DB
GET /api/health/ready     # real dependency check — DB + queue reachability, 200/503
GET /api/admin/system/preflight   # admin-authenticated — full configuration checklist
npm run preflight          # the same checklist, from the shell (exits 1 if not ready)
```

`/api/health` and `/api/health/ready` are deliberately public (a load
balancer/uptime monitor has no admin session) and never expose
connection strings, credentials, or infrastructure details beyond a
boolean + latency + a generic error string.

A healthy production deployment should show:
- `/api/health` → `200 {"status":"ok",...}`
- `/api/health/ready` → `200 {"status":"ok","checks":{"database":{"ok":true},"queue":{"ok":true}}}`
- `npm run preflight` → `Overall: READY`

---

## 9 · Monitoring the queue / DLQ

`/admin/reliability` (admin UI, RC-3) shows queue depth, dead-lettered
job count, retry rate, and a per-jobType failure breakdown, with safe
retry/cancel actions — fail-closed tenant-scoped, one organization can
never see or touch another's jobs. The same data is available at
`GET /api/admin/jobs` / `GET /api/admin/jobs/metrics`.

---

## 10 · Rollback

**Application rollback** — Vercel keeps every previous deployment
immutable and instantly promotable; use Vercel's own "Promote to
Production" on a prior deployment (dashboard or `vercel rollback`) to
revert application code in seconds. This does **not** touch the
database.

**Database migration rollback — application rollback does NOT
automatically reverse a data migration.** If a deploy included a
migration that needs to be undone:
1. Roll back the application code first (above) — stop new code from
   depending on the migrated shape.
2. Write and run a new, forward-only migration that reverses the
   change (never edit/delete a past migration entry — `_migrations`
   already recorded it as applied, and future deploys re-derive state
   from the full ordered history). Treat "undo" as "a new migration
   that undoes it," the same discipline a real production database
   migration tool (Rails, Django, Prisma Migrate) already enforces.
3. If the migration already caused irreversible data loss, restore
   from the database provider's own point-in-time backup (e.g. Atlas
   continuous backups) — this is why a real, provider-level backup
   strategy is a prerequisite for treating any migration as safe, not
   something this app's own code can substitute for.

**Zero-downtime note:** write any schema change to tolerate BOTH the
old and new code shape running simultaneously for the deploy window
(new optional fields, not renamed/removed ones in the same deploy) —
Vercel deploys are near-instant but not perfectly atomic across every
concurrent request in flight.

---

## 11 · Common failures

| Symptom | Likely cause | Where to look |
|---|---|---|
| `/api/health/ready` returns 503 | MongoDB unreachable/misconfigured | `MONGODB_URI`, Atlas network access list, `checks.database.error` in the response |
| Nothing async ever happens (no campaign sends, no automation steps) | `CRON_SECRET` unset, or Vercel Cron not configured | `vercel.json`, Vercel dashboard → Cron Jobs, `npm run preflight`'s Cron category |
| A queued job is stuck "processing" for a long time | A worker (poller invocation) crashed/was killed mid-job | It self-recovers after `STALE_CLAIM_MS` (10 minutes) — see `lib/services/scheduler/types.ts`; check `/admin/reliability` |
| File upload fails or the uploaded file "disappears" | `STORAGE_PROVIDER` is unset/`local` in production | `lib/startupValidation.ts`'s own loud startup error; set `aws_s3` or `cloudinary` |
| Users logged out unexpectedly / sessions don't verify | `JWT_ACCESS_TOKEN_SECRET` changed or is generating a new random value per instance (was never set) | Startup logs for `startup.insecure_secret_fallback` |
| Errors aren't showing up anywhere but stdout | `ERROR_TRACKING_PROVIDER` unset (defaults to `disabled`) | `.env.example`'s Observability section |
| A staging/preview deployment sent a real WhatsApp message or email | Real provider credentials leaked into a preview environment | `startup.real_provider_in_preview_environment` warning in that deployment's own logs |

---

## 12 · Fresh-environment check

To prove this app has no hidden dependency on one developer's own
machine: clone the repository fresh, copy `.env.example` to
`.env.local` (leave every value blank), then:

```
npm ci
npm run build
npm run test:unit
```

All three should succeed with **zero** environment configuration (this
was verified directly during RC-4's own audit — see CHANGELOG.md). Add
a real `MONGODB_URI` and re-run `npm run dev` to exercise the app
against a real database; nothing else is required to get a working
local instance.

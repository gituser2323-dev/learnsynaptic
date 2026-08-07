# LearnSynaptic Business OS

A multi-tenant CRM, WhatsApp/Email communication, automation, and
analytics platform for education businesses, built on top of the
original LearnSynaptic marketing site. This repository contains both:

- the **public marketing site** (`app/(marketing pages)`, `app/blog`,
  `app/programs`, etc.) — unchanged in spirit since before the CRM build
- the **Business OS** (`app/admin`, `app/api`, `lib/services`) — a full
  SaaS CRM platform: leads, pipelines, tasks, WhatsApp/email messaging,
  campaigns, workflow automation, AI-assisted CRM, analytics, billing,
  multi-tenant isolation, and a platform operator console

This README is the entry point. It does not restate what's already
documented in depth elsewhere — see [`docs/README.md`](docs/README.md)
for the full documentation index.

---

## What this is, concretely

LearnSynaptic Business OS lets an education business:

1. Capture leads (public forms, CSV import, API)
2. Run them through a configurable CRM pipeline (stages, tasks,
   activities, assignment rules)
3. Talk to them over WhatsApp (Meta Cloud API, real Embedded Signup
   self-service connection) and email (Postmark)
4. Automate follow-ups (a trigger → condition → action workflow engine)
5. Run WhatsApp campaigns to segments of leads
6. Get AI-assisted lead scoring, conversation insights, and reply
   suggestions (bring-your-own-provider: OpenAI/Anthropic/Gemini)
7. Track revenue, pipeline, campaign, and automation performance
8. Operate as a real multi-tenant SaaS: each customer organization is
   fully isolated, has its own plan/entitlements/trial, its own team,
   its own branding, and can self-onboard without any manual setup by
   LearnSynaptic staff
9. Be operated and supported by LearnSynaptic itself via a separate
   Platform Super Admin console (organization lifecycle, plan
   overrides, health, job/queue ops, security events) — structurally
   separate from tenant administration

**Build status**: every module in the original 35-module Business OS
blueprint (Phases 0–8) is complete, plus 7 Production Hardening
Release Candidates (RC-1 through RC-7 — Authentication, Security,
Reliability, Deployment, Disaster Recovery, Platform Admin, Customer
Onboarding). See [`docs/README.md`](docs/README.md) for where the
authoritative, current build status actually lives — it is **not** in
this README, which would go stale.

---

## Architecture, in one picture

```
Browser (marketing site + admin SPA)
        │
        ▼
Next.js 16 (App Router, Turbopack) — Vercel serverless
        │
        ├── middleware.ts — Edge runtime JWT verification,
        │   trusted-header injection, route matcher
        │
        ▼
API routes (app/api/**/route.ts) — withApiRoute() wrapper
        │   (auth · RBAC · tenant scope · rate limit · CSRF · audit)
        ▼
Service layer (lib/services/**) — business logic, one folder per domain
        │
        ▼
Repository layer (lib/db/repositories/**) — Mongo or in-memory,
        │   selected per-entity via lib/db/registry.ts
        ▼
MongoDB (Mongoose models, lib/db/models/**)
```

Cross-cutting concerns that sit beside this stack rather than inside
it: tenant context (`lib/tenancy/`), a MongoDB-backed scheduler acting
as this app's queue (`lib/services/scheduler/`, drained by Vercel Cron),
a generic provider-credential resolver (`lib/services/tenantCredentials/`
+ `lib/services/integrations/`), pluggable file storage, and a
provider-neutral error-tracking hook.

Full diagrams and a section-by-section walkthrough of every layer:
[`docs/architecture/overview.md`](docs/architecture/overview.md).

---

## Technology stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Language | TypeScript (strict) |
| Database | MongoDB via Mongoose (in-memory fallback for zero-config local dev/tests) |
| Auth | Custom JWT (access + refresh), `jose`, bcrypt, real TOTP MFA |
| Queue | MongoDB-backed scheduler drained by Vercel Cron — no separate Redis/worker service (see [ADR-0003](docs/development/adr/0003-queue-architecture.md)) |
| Styling | Tailwind CSS 4 |
| Testing | Vitest (unit), Playwright (E2E, real HTTP against a real server) |
| Deployment target | Vercel |

## Repository structure

```
app/
  (marketing pages)/       Public marketing site — unrelated to the CRM
  admin/                   Business OS UI (tenant admin + Platform Console)
  api/                     All HTTP API routes (190 route.ts files)
components/                Shared React components (admin/ + marketing)
config/                    Typed env-var access, one file per domain
lib/
  services/                Business logic, one directory per domain
  db/
    models/                Mongoose schemas (51 models)
    repositories/           Mongo + in-memory repository pairs
    registry.ts             Picks Mongo vs. in-memory per entity
  tenancy/                 AsyncLocalStorage tenant context
  api/                     withApiRoute(), RBAC, rate limiting, cookies
scripts/                   Operator CLI scripts (backup, migrate, seed, bootstrap)
tests/e2e/                 Playwright specs (real HTTP, real server)
docs/                      RC-8 documentation set — see docs/README.md
*.md (repo root)           RC audits, runbooks, and other long-form docs
                           predating docs/ — see docs/README.md for status
```

---

## Local development

```bash
git clone <repo-url>
cd learnsynaptic-main
npm install
cp .env.example .env.local   # every value may stay blank for local dev
npm run dev                  # http://localhost:3000
```

The app runs with **zero configuration**: no `.env.local` values set at
all still gives you a working local dev server (in-memory repositories,
a per-process JWT secret, no-op WhatsApp/email providers that log
instead of sending). This is a deliberate, load-bearing property — see
`lib/startupValidation.ts`.

To exercise real persistence, real WhatsApp/email/AI providers, or
anything RC-7's onboarding funnel needs end-to-end, set the relevant
variables in `.env.local` — see
[`docs/development/environment.md`](docs/development/environment.md)
for the authoritative variable-by-variable reference, or `.env.example`
in the repo root for the same information inline.

Full step-by-step walkthrough (MongoDB, seeding an admin user, running
migrations, logging in, running tests):
[`docs/development/local-development.md`](docs/development/local-development.md).

### Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run a production build locally |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript check (no dedicated script; run directly) |
| `npm run test:unit` | Vitest unit suite |
| `npm run test:e2e` | Playwright E2E suite (spins up its own server) |
| `npm run db:migrate` | Run pending Mongo migrations |
| `npm run db:sync-indexes` | Create/sync Mongoose indexes (never automatic in production) |
| `npm run preflight` | Real dependency/config health check |
| `npm run db:backup` / `db:restore` / `db:verify-backup` | Real MongoDB backup tooling — see [DR_RUNBOOK.md](DR_RUNBOOK.md) |
| `npm run platform:bootstrap-super-admin -- <email>` | Grant Platform Super Admin (CLI-only, no HTTP route) |

Every command above is a real script in `package.json` — nothing here
is aspirational.

---

## Testing

- **Unit** (`npm run test:unit`, Vitest): service-layer logic,
  concurrency races, validation, RBAC gates. Runs against in-memory
  repositories — no external dependencies needed.
- **E2E** (`npm run test:e2e`, Playwright): real HTTP requests against
  a real running Next.js server (its own `webServer`, in-memory store
  by default), covering RBAC, tenant isolation, and every major feature
  area's critical path, including deliberate pentests (forged headers,
  cross-tenant access attempts, IDOR).

Full breakdown of what's covered, how to run a subset, and what
infrastructure each suite needs:
[`docs/development/testing.md`](docs/development/testing.md).

---

## Production build & deployment

```bash
npm run build
npm run start
```

This app deploys to **Vercel** (serverless functions + Vercel Cron for
the scheduler). There is no separate worker process or Redis queue —
see [ADR-0003](docs/development/adr/0003-queue-architecture.md) for why.
Full deployment checklist, environment tiers (local/staging/production),
and rollback procedure:
[`docs/deployment/deployment.md`](docs/deployment/deployment.md) and
[`RUNBOOK.md`](RUNBOOK.md).

---

## Documentation index

This README is deliberately short. Everything else lives in
**[`docs/README.md`](docs/README.md)** — architecture, tenant model,
authentication, RBAC, the full API inventory + OpenAPI spec,
integrations, environment variables, deployment, operations,
disaster recovery, security, role-scoped user guides, troubleshooting,
and the engineering/contribution guide.

If you're looking for **current build/completion status**, that lives
in a periodically-republished audit artifact and the per-RC audit files
(`RC_6_AUDIT.md`, `RC_7_AUDIT.md`, ...) — see
[`docs/README.md`](docs/README.md#source-of-truth) for exactly where,
and why it's deliberately not duplicated here.

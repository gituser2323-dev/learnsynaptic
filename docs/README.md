# Documentation Index

This is the entry point into every document about this codebase.
Start at [the main README](../README.md) for a project overview; come
here for everything else.

---

## Source of truth

**This `docs/` tree (RC-8) and the current codebase are the only
sources of truth for CURRENT implementation status.** Everything here
describes the system as it actually exists, verified against the real
code — not the blueprint, not a plan, not aspirational.

A few root-level documents predate `docs/` and remain genuinely
**current, primary sources** for their own scope — kept in place, not
duplicated:

| Document | Still authoritative for |
|---|---|
| [`RUNBOOK.md`](../RUNBOOK.md) | Day-to-day production operations (RC-4) |
| [`DR_RUNBOOK.md`](../DR_RUNBOOK.md) | Backup, restore, disaster recovery (RC-5) |
| [`WHATSAPP_EMBEDDED_SIGNUP.md`](../WHATSAPP_EMBEDDED_SIGNUP.md) | Meta App Dashboard setup for WhatsApp self-service (Module 8.5) |
| [`CAMPAIGN_ARCHITECTURE.md`](../CAMPAIGN_ARCHITECTURE.md) | WhatsApp Campaign Manager detail |
| [`AUDIT_ARCHITECTURE.md`](../AUDIT_ARCHITECTURE.md) | Audit logging design |
| [`RC_6_AUDIT.md`](../RC_6_AUDIT.md) / [`RC_7_AUDIT.md`](../RC_7_AUDIT.md) / `RC_8_AUDIT.md` | Per-RC detailed architecture + verification record |
| [`CHANGELOG.md`](../CHANGELOG.md) | Full narrative build history, newest entries first |

### A real naming collision, disambiguated

This repository contains **two unrelated things both called "RC-1"** —
found and fixed during RC-8's own documentation audit, not hidden:

1. **The current Production Hardening Release Candidate track** —
   RC-1 (Authentication & Identity) through RC-7 (Customer Onboarding &
   SaaS Activation), each with its own `CHANGELOG.md` entry and (from
   RC-6 onward) a dedicated `RC_N_AUDIT.md` file. **This is the "RC-1"
   every current document means unless stated otherwise.**
2. **A much older, pre-blueprint "RC-1 — Release Candidate
   Stabilization"** pass (`RC_FIX_REPORT.md`, `PRODUCTION_SCORE.md`,
   and a separate `## RC-1` entry near the bottom of `CHANGELOG.md`) —
   unrelated, predates the 35-module blueprint entirely. All three of
   these files now carry an explicit historical-status banner pointing
   back here.

### Historical audits — not current implementation docs

The original 35-module Business OS Implementation Blueprint (Phases
0–8) and its own module-by-module completion tracking live in a
periodically-republished Claude Artifact
(`https://claude.ai/code/artifact/94c446c4-59ab-4f41-8e02-cc63574d5fd4`
at time of writing — it is republished to the same URL as the build
progresses, so always re-fetch rather than trusting a cached copy),
not a file in this repository. The blueprint is **complete** (100%
module coverage as of 2026-08-03); it is not where you'd look for
current API/architecture detail — this `docs/` tree is.

`API_DOCUMENTATION.md`, `WHATSAPP_ARCHITECTURE.md`, and
`PERFORMANCE_AUDIT.md` are older, narrower documents, each now carrying
its own status note about what's still accurate vs. superseded by this
`docs/` tree — read their own top-of-file status line before trusting
a specific claim in them.

---

## Architecture

- [Overview](architecture/overview.md) — system shape, request
  lifecycle, layers, cross-cutting concerns
- [Tenant architecture](architecture/tenant.md) — multi-tenancy,
  isolation, credentials, billing, branding, onboarding state
- [Authentication](architecture/auth.md) — sessions, registration,
  MFA, OAuth, invitations
- [RBAC](architecture/rbac.md) — the real permissions matrix
- [Database](architecture/database.md) — domains, relationships,
  migrations

## API

- [API inventory](api/inventory.md) — every real endpoint, mechanically
  generated
- [OpenAPI spec](api/openapi.json) — machine-readable; interactive UI
  at `/api/docs/reference` (tenant Admin session required)
- [API security model](api/security.md) — auth, rate limits,
  idempotency, error envelope
- [Webhooks](api/webhooks.md) — inbound (WhatsApp/Email/Payments) and
  outbound (Module 6.5)

## Integrations

- [Integration matrix](integrations/matrix.md) — CODE READY /
  CONFIGURED / LIVE VERIFIED / REQUIRES EXTERNAL CONFIGURATION, per
  provider
- [WhatsApp](integrations/whatsapp.md)
- [Automation platform](integrations/automation.md)
- [AI CRM](integrations/ai.md)

## Development

- [Local development guide](development/local-development.md)
- [Environment variables](development/environment.md) — points at
  `.env.example` as the authoritative reference
- [Testing](development/testing.md)
- [Migrations & backfills](development/migrations.md)
- [Contribution / engineering guide](development/contributing.md)
- [Coding safety rules](development/safety-rules.md)
- [Architecture Decision Records](development/adr/)

## Deployment

- [Deployment guide](deployment/deployment.md)
- [Staging guide](deployment/staging.md)

## Operations

- [Troubleshooting](operations/troubleshooting.md)
- [Error catalog](operations/error-catalog.md)
- [Support diagnostics](operations/support-diagnostics.md) — what's
  safe to ask a customer for, and what to never ask for
- Production runbook: [`RUNBOOK.md`](../RUNBOOK.md)
- Disaster recovery: [`DR_RUNBOOK.md`](../DR_RUNBOOK.md)

## Security

- [Security architecture overview](security/overview.md)

## User guides (by role)

- [Platform Super Admin](user-guides/platform-admin.md)
- [Tenant Admin](user-guides/tenant-admin.md)
- [Manager](user-guides/manager.md)
- [Counsellor](user-guides/counsellor.md)
- [Customer onboarding](user-guides/onboarding.md) — what a new
  business owner experiences signing up

---

## Documentation access classification

| Tier | Covers | Access |
|---|---|---|
| **Public** | The marketing site itself; nothing in this `docs/` tree is served publicly | N/A — this is a repository, not a hosted docs site |
| **Developer-internal** | Everything in this `docs/` tree, plus the interactive API reference (`/api/docs/reference`) | Repository access; the interactive API UI additionally requires a real tenant Admin session (`requiredRole: "admin"`) — see that route's own doc comment |
| **Platform-operator-only** | Platform Console operational detail beyond what's in [`platform-admin.md`](user-guides/platform-admin.md) | `platformRole: "super_admin"`, CLI-granted only |

No document in this tree is served by the running application itself
except the OpenAPI spec and the Scalar reference UI — both gated to an
authenticated tenant Admin session, never public. See
[`docs/api/security.md`](api/security.md) and
[`docs/security/overview.md`](security/overview.md).

## Keeping this in sync

- `docs/api/openapi.json` and `docs/api/inventory.md`'s table:
  regenerate with `npx tsx scripts/docs/generateOpenApiSpec.ts` after
  any route change.
- `.env.example`: add a line for any new `process.env.*` reference in
  the same change that introduces it — see
  [`development/environment.md`](development/environment.md#5--keeping-this-in-sync).
- Everything else here is prose, reviewed for accuracy as part of
  RC-8; keep it honest the same way — document what exists, not what's
  planned, and disclose a gap rather than paper over it.

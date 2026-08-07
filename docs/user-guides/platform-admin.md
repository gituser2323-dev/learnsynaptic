# Platform Super Admin Guide

**Status: current (RC-6).** For LearnSynaptic's own operators — the
people running the SaaS deployment itself, not a customer's team. A
tenant Admin, even the highest tenant rank, has **none** of this
access. See [`docs/architecture/rbac.md`](../architecture/rbac.md#4--platform-super-admin--a-separate-axis-not-a-4th-tenant-rank)
for why the two are structurally separate.

---

## 1 · Getting access

There is **no** self-service or in-app way to become a Platform Super
Admin. An existing account (created the normal way) is granted the
role via a CLI script, run by someone with deploy/shell access:

```bash
npm run platform:bootstrap-super-admin -- you@example.com
```

MFA must be enabled on the account — every platform route requires it,
checked with a real database read on every request. Sign in normally
at `/admin/login`; the Platform Console is a separate area at
`/admin/platform`, not mixed into the ordinary tenant admin navigation.

## 2 · What you can do

### Organizations (`/admin/platform/organizations`)

- Search/filter every customer organization on the deployment.
- View a real, cross-service detail page: subscription, plan,
  resolved entitlements, active user count.
- **Suspend** an organization (requires typing a reason) — blocks new
  mutating writes and background job execution for that organization,
  reversible via **Reactivate**. Does not touch historical data,
  billing state, or audit logs.
- **Extend trial**, **override a plan capability or usage limit** for
  one organization specifically — always reversible, always audited,
  never changes the shared Plan catalog every other customer on that
  plan also uses.

### Platform Dashboard (`/admin/platform`)

Real, non-fabricated numbers: total/active/suspended organizations,
platform users, subscriptions by status, failed payments (24h),
platform health, queue depth, estimated MRR (explicitly labeled as an
estimate — it does not account for proration, discounts, or
payment-provider-side adjustments).

### Onboarding funnel (`/admin/platform/onboarding`)

Aggregate, real funnel: registered → verified → organization created →
trial started → integration connected → activated, plus per-
organization status (not started / in progress / activated). **Never**
a tenant's private CRM contents — only status.

### Jobs & Queue (`/admin/platform/jobs`)

Cross-tenant queue/DLQ visibility, retry/cancel. Retrying a job whose
type is classified **MUST NOT REPLAY AUTOMATICALLY** (a real WhatsApp
send, a webhook delivery, a notification) is refused with a visible
reason, not silently no-op'd — see `DR_RUNBOOK.md` §10 for the full
per-job-type classification before overriding this manually.

### Security Events (`/admin/platform/security-events`)

A filtered, cross-tenant read of the security audit trail — forbidden-
access attempts, MFA changes, login anomalies. Not a SIEM; no
correlation engine.

### Health (`/api/admin/platform/health`)

The same preflight checks (`Database`/`Authentication`/`Encryption`/
`Queue`/`Cron`/`Workers`/`Storage`/`Observability`) available at
`/api/admin/system/preflight`, plus every tenant integration's
configured state.

## 3 · What you explicitly do NOT get

- **No automatic tenant CRM access.** Being a Platform Super Admin
  does not grant you a tenant's `role` inside any organization — you
  cannot read a customer's leads/conversations/messages through this
  console. It reports status (Configured/Missing/Healthy), never
  content.
- **No support impersonation ("log in as a customer")** — evaluated
  during RC-6 and deliberately deferred, not built. A safe
  implementation needs session-labeling/time-boxing infrastructure
  this deployment doesn't have yet; a partial version would be exactly
  the unsafe "login as user" pattern this was deferred to avoid.
- **No platform-wide announcement/broadcast mechanism** — evaluated,
  not built (no existing broadcast primitive to extend safely).
- **No way to mutate the global Plan catalog from a per-organization
  action** — overrides are always organization-specific and
  reversible; changing what a Plan itself offers every subscriber is a
  separate, more deliberate action (`admin.billing.plans.*` routes,
  additionally gated by `PLATFORM_ADMIN_SECRET`).

## 4 · Every action is audited

Every sensitive platform action — and every **forbidden attempt** at
one, including from a tenant Admin probing `/api/admin/platform/*` —
writes a real, inspectable audit entry: operator, target organization,
action, timestamp, reason (where the action itself required one). See
[`docs/security/overview.md`](../security/overview.md#11--audit-logging).

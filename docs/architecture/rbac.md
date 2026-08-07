# RBAC — Permissions Matrix

**Status: current.** Derived mechanically from every `withApiRoute()`
call in the repository (226 route handlers across 190 files), not
written from memory of what was intended. See
[`docs/api/inventory.md`](../api/inventory.md) for the exhaustive
per-endpoint table this summarizes.

---

## 1 · The real roles that exist

There are exactly **four** privilege tiers across **two independent
axes** — no other role exists anywhere in the codebase
(`lib/services/auth/types.ts`):

**Tenant axis** (`User.role`, rank-based, `>=` comparison — a route
requiring `"manager"` also admits `"admin"`):

| Rank | Role | 
|---|---|
| 1 (lowest) | **Counsellor** |
| 2 | **Manager** |
| 3 (highest) | **Tenant Admin** |

**Platform axis** (`User.platformRole`, independent, never compared to
tenant `role`):

| Value | Role |
|---|---|
| `"super_admin"` | **Platform Super Admin** |

A tenant Admin (rank 3, the highest tenant rank) has **zero** platform
privileges by default and can never acquire them through any HTTP
route — `platformRole` is granted exclusively via a CLI script
(`scripts/bootstrapPlatformSuperAdmin.ts`) run with deploy/operator
shell access. See [`docs/user-guides/platform-admin.md`](../user-guides/platform-admin.md).

## 2 · Enforcement is server-side, always

Every gate below is checked in `lib/api/withApiRoute.ts` — a UI element
being hidden for a role is a convenience, never the actual boundary.
`hasRequiredRole()` compares `ROLE_RANK[context.role] >=
ROLE_RANK[required]`; `hasPlatformRole()` is a structurally separate
function that **never reads `context.role` at all** — the two checks
cannot be confused or accidentally combined into one comparison. See
[`docs/architecture/overview.md`](overview.md#2--request-lifecycle-withapiroute)
for the full check ordering.

## 3 · Permissions matrix by feature domain

Minimum tenant role required per domain (routes with no `requiredRole`
are either public, `auth.*`/`onboarding.*` self-service, or gated only
by `requiredPlatformRole` instead — see the notes column):

| Domain | Counsellor | Manager | Tenant Admin | Notes |
|---|:---:|:---:|:---:|---|
| Leads (read/create/update) | ✅ | ✅ | ✅ | Bulk operations require Manager |
| Tasks, Activities, Meetings | ✅ | ✅ | ✅ | Own day-to-day work |
| Conversations (view, reply, notes) | — | — | ✅ | All 11 conversation routes require Admin today |
| CRM configuration (pipelines, custom fields, assignment rules, tags, merge/duplicates) | — | ✅ | ✅ | Manager can configure; Counsellor cannot |
| Files (upload/download own attachments) | ✅ | ✅ | ✅ | |
| Analytics / Executive Dashboard | — | — | ✅ | |
| Automation (workflows, auto-reply rules) | — | — | ✅ | |
| WhatsApp Campaigns | — | — | ✅ | |
| Payments | — | ✅ | ✅ | Refund/check-status admin-only within the domain |
| Integrations (connect/configure) | — | — | ✅ | Read-only status views are Counsellor-reachable in places |
| Billing (plans, subscription, usage) | — | Partial | ✅ | Viewing usage is Manager+; plan/subscription changes are Admin-only |
| Branding | ✅ (read) | — | ✅ (write) | |
| Team (invitations) | — | — | ✅ | |
| Users (admin directory) | — | Partial | ✅ | |
| Webhooks (endpoints, deliveries) | — | — | ✅ | |
| Audit logs | — | — | ✅ | |
| Settings, System preflight, Scheduler ops | — | — | ✅ | |
| Registrations (admin list) | — | — | ✅ | |
| Platform Console (all of it) | — | — | — | Requires `platformRole: "super_admin"`, independent of tenant role — see §4 |

For the **exact** route-by-route requirement (some sub-actions inside a
domain differ from the domain's general tier — e.g. most of CRM is
Manager+ but `crm.leaderboard`/`crm.pipeline_analytics` reads are
Counsellor-reachable), always check
[`docs/api/inventory.md`](../api/inventory.md) or the OpenAPI spec
rather than this summary table for a specific route.

## 4 · Platform Super Admin — a separate axis, not a 4th tenant rank

17 routes require `requiredPlatformRole: "super_admin"` — all under
`/api/admin/platform/*`. None of them also require a tenant `role`;
a Platform Super Admin's tenant `role` (if they even belong to an
organization at all) is irrelevant to whether they can reach these
routes. Every platform route additionally requires the acting account
to have MFA enabled, verified with a real database read on every
request. See [`docs/user-guides/platform-admin.md`](../user-guides/platform-admin.md).

## 5 · What a role does NOT get, explicitly

- **Counsellor** cannot configure the CRM (pipelines, assignment
  rules), cannot see Analytics/Automation/Billing/Integrations, cannot
  invite team members, cannot manage conversations directly (today,
  every conversation route requires Admin).
- **Manager** cannot manage Team invitations, Automation, Webhooks,
  Audit Logs, or Settings — these remain Admin-only even though Manager
  outranks Counsellor.
- **Tenant Admin** — even though it is the highest tenant rank — has
  **no** access to any `/api/admin/platform/*` route, cannot suspend
  organizations, cannot override another organization's plan, and
  cannot grant itself `platformRole` through any HTTP action. This is
  the load-bearing security property RC-6 was built around; see
  `RC_6_AUDIT.md` §15 for the real, over-HTTP pentest proof.
- **Platform Super Admin** does not automatically get tenant-level
  access to any organization's CRM data — the platform axis answers
  "can operate the SaaS," not "can read this tenant's leads." Platform
  routes report safe aggregate/status information (counts, health,
  Configured/Missing) — never a tenant's private CRM contents.

## 6 · Role-scoped guides

What each tier can actually *do*, in plain operational terms (not just
what's blocked):

- [`docs/user-guides/counsellor.md`](../user-guides/counsellor.md)
- [`docs/user-guides/manager.md`](../user-guides/manager.md)
- [`docs/user-guides/tenant-admin.md`](../user-guides/tenant-admin.md)
- [`docs/user-guides/platform-admin.md`](../user-guides/platform-admin.md)

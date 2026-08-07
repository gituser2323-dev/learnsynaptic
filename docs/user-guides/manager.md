# Manager Guide

**Status: current — verified route-by-route.** Manager sits between
Counsellor and Tenant Admin. Everything a Counsellor can do (see
[`counsellor.md`](counsellor.md)), plus what's below. This page only
documents what a Manager account can actually reach — never a
Platform- or tenant-Admin-only operation.

---

## Everything a Counsellor can do, plus:

### Leads

Assign a lead to a team member (`POST /api/admin/leads/[id]/assign`),
run bulk operations — bulk delete/restore/tag (`POST
/api/admin/leads/bulk`).

### Tasks

Reassign a task to someone else
(`POST /api/admin/crm/tasks/[id]/reassign`).

### CRM configuration

- Pipelines: create/view/delete (`/api/admin/crm/pipelines*`)
- Custom fields: create/view/delete
- Assignment rules: create/view
- Tags: create/delete (Counsellor can only view/apply)
- Duplicate detection and lead merge (`/api/admin/crm/duplicates`,
  `/api/admin/crm/merge`)
- CSV lead import (`/api/admin/crm/import`)

### Opportunities

Full CRUD and stage-move (`/api/admin/crm/opportunities*`) — a
Counsellor cannot touch Opportunities directly at all.

### Analytics (partial)

Pipeline analytics and the leaderboard
(`/api/admin/crm/pipeline-analytics`, `/api/admin/crm/leaderboard`).

### Payments

Most payment operations (list, view, analytics) — refund and manual
retry remain Admin-only within the Payments domain.

### Billing

View subscription/usage — cannot change or cancel a plan (Admin-only).

### Users

Partial access to the staff directory (list) — user management
actions remain Admin-only.

## What you cannot do

Configure Team invitations, Automation, Webhooks, Integrations
(connect/configure), Branding, Audit Logs, or Settings — all
Admin-only. **Conversations remain unreachable to Manager too** — see
[`counsellor.md`](counsellor.md#conversations--a-real-current-limitation-not-an-oversight-to-assume-away)
for the same real, current gap (every conversation route requires
Admin today, not Manager+). See
[`docs/architecture/rbac.md`](../architecture/rbac.md) for the
complete matrix.

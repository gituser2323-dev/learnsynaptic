# Counsellor Guide

**Status: current — verified route-by-route against the real RBAC
gates, not written from the role's intended purpose alone.** Counsellor
is the day-to-day, lowest-privilege tenant role. Everything below is
what a Counsellor account can actually reach today.

---

## Leads

- View your assigned leads and their full detail (`GET
  /api/admin/leads`, `GET /api/admin/leads/[id]`).
- Update a lead's own fields (`PATCH /api/admin/leads/[id]`), tag it
  (`PUT /api/admin/leads/[id]/tags`), and view/trigger its AI insights
  (`GET`/`POST /api/admin/leads/[id]/insights`).
- **Cannot** assign a lead to someone else, or perform a bulk
  operation (bulk-delete/bulk-restore/bulk-tag) — both are Manager+.

## Tasks

Full day-to-day task management: create, update, complete
(`/api/admin/crm/tasks*`). **Cannot** reassign a task to someone else
— that's Manager+.

## Activities

Log and view activities on a lead's timeline
(`/api/admin/crm/activities`) — full access.

## Tags

Can view/apply existing tags. **Cannot** create or delete a tag
definition — that's Manager+.

## Follow-ups / Pipeline actions

Day-to-day pipeline work happens through Leads/Tasks/Activities above.
**Cannot** move an Opportunity between pipeline stages, view
pipeline/leaderboard analytics, or configure a pipeline — all
Manager+.

## Conversations — a real, current limitation, not an oversight to assume away

**Every conversation route currently requires the Admin tier** —
`GET`/reply/assign/notes/labels/status/AI-reply/insights on a
Conversation are all `requiredRole: "admin"` today, verified directly
against every route's real registration (see
[`docs/api/inventory.md`](../api/inventory.md#conversations)). A
Counsellor account, despite being the role most naturally suited to
day-to-day conversation handling, **cannot** open the Conversations
inbox through the current admin API. This is stated here plainly
because it's a real, surprising-if-undocumented gap between what a
Counsellor's role conceptually implies and what the RBAC gate actually
enforces — flagged as a real product gap for a future RC to evaluate
(should Conversations open up to Counsellor/Manager?), not silently
assumed to already work.

## What you cannot do, summarized

Configure the CRM (pipelines, custom fields, assignment rules),
reassign leads/tasks, run bulk operations, see Analytics/Automation/
Billing/Integrations/Team/Webhooks/Audit Logs/Settings, or access
Conversations (see above). All of these require Manager or Admin — see
[`docs/architecture/rbac.md`](../architecture/rbac.md) for the full
matrix.

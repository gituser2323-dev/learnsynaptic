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

## Conversations (Phase 2A)

You can open **Conversations** for WhatsApp/email threads tied to
**leads assigned to you** (or conversations where you are the explicit
`assignedTo` assignee). You can reply, add notes, open/close, and use
AI reply/insights on those threads. You **cannot** assign conversations
or edit labels (Manager+). Unassigned org-wide threads stay invisible
to you until a Manager assigns the lead or the conversation.


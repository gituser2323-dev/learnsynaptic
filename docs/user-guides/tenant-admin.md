# Tenant Admin Guide

**Status: current.** For the highest-ranking user inside **your own**
organization. Everything below is scoped to your organization only —
see [`docs/architecture/tenant.md`](../architecture/tenant.md) for why
this is a structural guarantee, not a UI convention. Tenant Admin has
no access to any other organization, and no Platform Super Admin
access (see [`platform-admin.md`](platform-admin.md)) unless separately
granted via CLI.

---

## Team

Settings → Team: invite people by email + role (Counsellor/Manager/
Admin — the only three tenant roles that exist, see
[`docs/architecture/rbac.md`](../architecture/rbac.md)). An invitation
is single-use, expires after 7 days, and is bound to your organization
— it can never be accepted into a different one. Seat count is
enforced server-side against your plan's limit; you cannot send more
invitations than your plan allows, even if you retry.

## CRM & Pipelines

Configure pipelines, stages, custom fields, tags, and assignment rules
under Settings → CRM. A brand-new organization gets a real default
pipeline with 10 standard stages automatically — customize it, or
build your own from scratch. Import leads via CSV (validated, mapped,
deduplicated, previewed before commit) rather than one-by-one entry
for a large list.

## WhatsApp

Settings → Integrations → WhatsApp → **Connect WhatsApp** — a
self-service flow (Meta's Embedded Signup) that discovers your own
WhatsApp Business Account, no manual token entry, no waiting on
LearnSynaptic staff. Requires your plan to include the capability —
if it doesn't, the button is honestly disabled/upsold, never a broken
promise. See [`docs/integrations/whatsapp.md`](../integrations/whatsapp.md).

## Campaigns

Bulk WhatsApp sends to a segment of your leads, with real scheduling,
recurrence, archive/clone, and reply/click attribution. See
[`CAMPAIGN_ARCHITECTURE.md`](../../CAMPAIGN_ARCHITECTURE.md).

## Automation

Build workflows: an event (a new lead, a completed task, ...) →
optional conditions → one or more actions (send a WhatsApp template,
send an email, assign the lead, create a task, run an AI analysis,
schedule a meeting). See
[`docs/integrations/automation.md`](../integrations/automation.md).
The separate Auto-Reply Engine (Settings → Automation → Auto-Reply
Rules) handles immediate replies to an inbound message — a smaller,
deliberately separate system from workflow automation.

## Integrations

Settings → Integrations is the one place every provider connection
lives — WhatsApp, Email, AI, Calendar, Payments, Storage, generic
Slack/Teams/Discord notifications. Each card honestly reports
Configured/Missing/Expired — never a fabricated "connected" state. See
[`docs/integrations/matrix.md`](../integrations/matrix.md) for what's
real per provider in a given deployment.

## Billing

Settings → Billing: current plan, usage against your plan's limits,
trial status. Assigning/changing a plan and cancelling a subscription
are Admin-only actions; viewing usage is available to Managers too.

## Branding

Settings → Branding: accent color (server-validated for real WCAG 2.1
contrast — an unreadable color is rejected with the actual reason, not
silently allowed), logo, favicon, footer text. Requires your plan to
include white-label capability. Core layout/text/surface colors are
never overridable — this is what keeps a bad brand color from making
the app unusable.

## Security

Enable MFA for your own account (Settings → Security) — recommended
for every Admin account, required for any Platform Super Admin
account. Review active sessions and login history; revoke a session
you don't recognize. See
[`docs/architecture/auth.md`](../architecture/auth.md).

## What you can't do

- Access another organization's data — structurally impossible, not
  just against policy.
- Grant yourself or anyone else Platform Super Admin access — that's
  CLI-only, by an operator with shell access to the deployment.
- Exceed your plan's entitlements — every limit (seats, WhatsApp
  sends, AI requests, automation executions, file storage, and more)
  is enforced server-side, not just hidden in the UI.

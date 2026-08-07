# API Inventory

**Status: current, mechanically generated.** Every row below was
extracted directly from the real `withApiRoute()` registration in each
`app/api/**/route.ts` file — 226 HTTP operations across 189 route
files, last generated 2026-08-05. This is not hand-maintained and
cannot silently drift into listing an endpoint that doesn't exist:
regenerate it with

```bash
npx tsx scripts/docs/generateOpenApiSpec.ts
```

which also produces [`openapi.json`](openapi.json) — the machine-
readable version of this same data, browsable interactively at
`/api/docs/reference` (real session, tenant Admin role required — see
[`docs/api/security.md`](security.md)).

**Columns**: *Auth* is the minimum requirement to reach the handler at
all — see
[`docs/architecture/overview.md`](../architecture/overview.md#2--request-lifecycle-withapiroute)
for the full check ordering (MFA is additionally required for every
`Platform` row; almost every `Session, role ≥ X` route is also
tenant-scoped inside `runWithTenantContext()` — see
[`docs/architecture/tenant.md`](../architecture/tenant.md) and
[`docs/architecture/rbac.md`](../architecture/rbac.md) for that detail
rather than a repeated column here). *Rate limit* is
`requests/windowMs` per route+client-IP bucket
(`lib/api/rateLimit/inMemory.ts`) — routes with no configured limit
show `—`.

For exact request/response body shapes, see the linked source file in
the OpenAPI spec's `x-source-file` field for that operation — this
codebase validates request bodies with hand-rolled per-service
validator functions, not a schema library, so a body shape is only
ever truly authoritative in its own source file, never a second,
driftable copy here.

The one HTTP route in this codebase deliberately **not** wrapped in
`withApiRoute()` — `GET /api/files/local/[...key]` — is not listed
below (a route-name-based inventory has nothing meaningful to say about
it); see that file's own doc comment for why it's safe: it's a
signed-URL delivery endpoint whose HMAC signature check *is* its access
control, the same shape a real S3 presigned URL already has.

---

### Analytics

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/analytics` | `admin.analytics.get` | Session, role ≥ `admin` | 60/60_000 |
| GET | `/api/admin/analytics/revenue` | `admin.analytics.revenue.get` | Session, role ≥ `admin` | 30/60_000 |

### Attendance

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/attendance` | `admin.attendance.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/attendance` | `admin.attendance.mark` | Session, role ≥ `admin` | 60/60_000 |

### Audit Logs

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/audit-logs` | `admin.audit_logs.list` | Session, role ≥ `admin` | 60/60_000 |

### Auth

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| POST | `/api/auth/change-password` | `auth.changePassword` | Session, role ≥ `counsellor` | 10/15 * 60 * 1000 |
| POST | `/api/auth/forgot-password` | `auth.forgotPassword` | Public or pre-org session | 5/15 * 60 * 1000 |
| POST | `/api/auth/invitations/accept` | `auth.invitations.accept` | Public or pre-org session | 10/15 * 60 * 1000 |
| POST | `/api/auth/login` | `auth.login` | Public or pre-org session | 10/15 * 60 * 1000 |
| GET | `/api/auth/login-history` | `auth.loginHistory` | Session, role ≥ `counsellor` | 30/60_000 |
| POST | `/api/auth/logout` | `auth.logout` | Public or pre-org session | 30/60_000 |
| GET | `/api/auth/me` | `auth.me` | Session, role ≥ `counsellor` | 60/60_000 |
| POST | `/api/auth/mfa/confirm` | `auth.mfa.confirm` | Session, role ≥ `counsellor` | 10/60_000 |
| POST | `/api/auth/mfa/disable` | `auth.mfa.disable` | Session, role ≥ `counsellor` | 10/60_000 |
| POST | `/api/auth/mfa/recovery-codes` | `auth.mfa.regenerateRecoveryCodes` | Session, role ≥ `counsellor` | 5/60_000 |
| POST | `/api/auth/mfa/request-email-otp` | `auth.mfa.requestEmailOtp` | Public or pre-org session | 5/15 * 60 * 1000 |
| POST | `/api/auth/mfa/setup` | `auth.mfa.setup` | Session, role ≥ `counsellor` | 10/60_000 |
| GET | `/api/auth/mfa/trusted-devices` | `auth.mfa.trustedDevices.list` | Session, role ≥ `counsellor` | 30/60_000 |
| DELETE | `/api/auth/mfa/trusted-devices/{id}` | `auth.mfa.trustedDevices.revoke` | Session, role ≥ `counsellor` | 20/60_000 |
| GET | `/api/auth/oauth/accounts` | `auth.oauth.accounts.list` | Session, role ≥ `counsellor` | 30/60_000 |
| DELETE | `/api/auth/oauth/accounts/{id}` | `auth.oauth.accounts.unlink` | Session, role ≥ `counsellor` | 20/60_000 |
| POST | `/api/auth/oauth/mfa/verify` | `auth.oauth.mfa.verify` | Public or pre-org session | 10/15 * 60 * 1000 |
| GET | `/api/auth/oauth/providers` | `auth.oauth.providers` | Public or pre-org session | 60/60_000 |
| GET | `/api/auth/oauth/{provider}/authorize` | `auth.oauth.authorize` | Public or pre-org session | 20/60_000 |
| GET | `/api/auth/oauth/{provider}/callback` | `auth.oauth.callback` | Public or pre-org session | 20/60_000 |
| POST | `/api/auth/refresh` | `auth.refresh` | Public or pre-org session | 30/60_000 |
| POST | `/api/auth/register` | `auth.register` | Public or pre-org session | 5/15 * 60 * 1000 |
| POST | `/api/auth/resend-verification` | `auth.resendVerification` | Session, role ≥ `counsellor` | 5/15 * 60 * 1000 |
| POST | `/api/auth/reset-password` | `auth.resetPassword` | Public or pre-org session | 10/15 * 60 * 1000 |
| GET | `/api/auth/sessions` | `auth.sessions.list` | Session, role ≥ `counsellor` | 30/60_000 |
| POST | `/api/auth/sessions/revoke-others` | `auth.sessions.revokeOthers` | Session, role ≥ `counsellor` | 10/60_000 |
| DELETE | `/api/auth/sessions/{id}` | `auth.sessions.revoke` | Session, role ≥ `counsellor` | 20/60_000 |
| POST | `/api/auth/verify-email` | `auth.verifyEmail` | Public or pre-org session | 20/15 * 60 * 1000 |

### Automation

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/automation/auto-reply-rules` | `admin.automation.autoReplyRules.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/automation/auto-reply-rules` | `admin.automation.autoReplyRules.create` | Session, role ≥ `admin` | 20/60_000 |
| DELETE | `/api/admin/automation/auto-reply-rules/{id}` | `admin.automation.autoReplyRules.delete` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/automation/auto-reply-rules/{id}` | `admin.automation.autoReplyRules.get` | Session, role ≥ `admin` | 60/60_000 |
| PATCH | `/api/admin/automation/auto-reply-rules/{id}` | `admin.automation.autoReplyRules.update` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/automation/definitions` | `admin.automation.definitions.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/automation/definitions` | `admin.automation.definitions.create` | Session, role ≥ `admin` | 20/60_000 |
| DELETE | `/api/admin/automation/definitions/{id}` | `admin.automation.definitions.delete` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/automation/definitions/{id}` | `admin.automation.definitions.get` | Session, role ≥ `admin` | 60/60_000 |
| PATCH | `/api/admin/automation/definitions/{id}` | `admin.automation.definitions.update` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/automation/runs` | `admin.automation.runs.list` | Session, role ≥ `admin` | 60/60_000 |

### Billing

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/billing/feature-flags` | `admin.billing.feature_flags.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/billing/feature-flags` | `admin.billing.feature_flags.create` | Session, role ≥ `admin` | 20/60_000 |
| PATCH | `/api/admin/billing/feature-flags/{key}` | `admin.billing.feature_flags.update` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/billing/plans` | `admin.billing.plans.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/billing/plans` | `admin.billing.plans.create` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/billing/plans/{id}` | `admin.billing.plans.get` | Session, role ≥ `admin` | 60/60_000 |
| PATCH | `/api/admin/billing/plans/{id}` | `admin.billing.plans.update` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/billing/subscription` | `admin.billing.subscription.get` | Session, role ≥ `manager` | 60/60_000 |
| POST | `/api/admin/billing/subscription/assign-plan` | `admin.billing.subscription.assign_plan` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/billing/subscription/cancel` | `admin.billing.subscription.cancel` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/billing/usage` | `admin.billing.usage.get` | Session, role ≥ `manager` | 60/60_000 |

### Branding

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/branding` | `admin.branding.get` | Session, role ≥ `counsellor` | 120/60_000 |
| DELETE | `/api/admin/branding/config` | `admin.branding.config.reset` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/branding/config` | `admin.branding.config.get` | Session, role ≥ `admin` | 60/60_000 |
| PUT | `/api/admin/branding/config` | `admin.branding.config.update` | Session, role ≥ `admin` | 20/60_000 |

### Campaigns

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/campaigns` | `admin.campaigns.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/campaigns` | `admin.campaigns.create` | Session, role ≥ `admin` | 20/60_000 |

### Conversations

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/conversations` | `admin.conversations.list` | Session, role ≥ `admin` | 60/60_000 |
| GET | `/api/admin/conversations/media/{messageId}` | `admin.conversations.media` | Session, role ≥ `admin` | 60/60_000 |
| GET | `/api/admin/conversations/{id}` | `admin.conversations.get` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/conversations/{id}/ai-reply` | `admin.conversations.aiReply.generate` | Session, role ≥ `admin` | 15/60_000 |
| POST | `/api/admin/conversations/{id}/assign` | `admin.conversations.assign` | Session, role ≥ `admin` | 40/60_000 |
| GET | `/api/admin/conversations/{id}/insights` | `admin.conversations.insights.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/conversations/{id}/insights` | `admin.conversations.insights.analyze` | Session, role ≥ `admin` | 10/60_000 |
| PUT | `/api/admin/conversations/{id}/labels` | `admin.conversations.labels` | Session, role ≥ `admin` | 40/60_000 |
| POST | `/api/admin/conversations/{id}/messages` | `admin.conversations.sendMessage` | Session, role ≥ `admin` | 30/60_000 |
| POST | `/api/admin/conversations/{id}/notes` | `admin.conversations.notes` | Session, role ≥ `admin` | 40/60_000 |
| PATCH | `/api/admin/conversations/{id}/status` | `admin.conversations.status` | Session, role ≥ `admin` | 40/60_000 |

### Crm

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/crm/activities` | `admin.crm.activities.list` | Session, role ≥ `counsellor` | 60/60_000 |
| POST | `/api/admin/crm/activities` | `admin.crm.activities.create` | Session, role ≥ `counsellor` | 60/60_000 |
| GET | `/api/admin/crm/assignment-rules` | `admin.crm.assignment_rules.get` | Session, role ≥ `manager` | 60/60_000 |
| POST | `/api/admin/crm/assignment-rules` | `admin.crm.assignment_rules.set` | Session, role ≥ `manager` | 20/60_000 |
| GET | `/api/admin/crm/custom-fields` | `admin.crm.custom_fields.list` | Session, role ≥ `manager` | 60/60_000 |
| POST | `/api/admin/crm/custom-fields` | `admin.crm.custom_fields.create` | Session, role ≥ `manager` | 20/60_000 |
| DELETE | `/api/admin/crm/custom-fields/{id}` | `admin.crm.custom_fields.delete` | Session, role ≥ `manager` | 20/60_000 |
| GET | `/api/admin/crm/duplicates` | `admin.crm.duplicates.list` | Session, role ≥ `manager` | 30/60_000 |
| POST | `/api/admin/crm/import` | `admin.crm.import` | Session, role ≥ `manager` | 10/60_000 |
| GET | `/api/admin/crm/leaderboard` | `admin.crm.leaderboard.get` | Session, role ≥ `manager` | 30/60_000 |
| POST | `/api/admin/crm/merge` | `admin.crm.merge` | Session, role ≥ `manager` | 20/60_000 |
| GET | `/api/admin/crm/opportunities` | `admin.crm.opportunities.list` | Session, role ≥ `manager` | 60/60_000 |
| POST | `/api/admin/crm/opportunities` | `admin.crm.opportunities.create` | Session, role ≥ `manager` | 30/60_000 |
| POST | `/api/admin/crm/opportunities/{id}/move` | `admin.crm.opportunities.move` | Session, role ≥ `manager` | 60/60_000 |
| GET | `/api/admin/crm/pipeline-analytics` | `admin.crm.pipelineAnalytics.get` | Session, role ≥ `manager` | 30/60_000 |
| GET | `/api/admin/crm/pipelines` | `admin.crm.pipelines.list` | Session, role ≥ `manager` | 60/60_000 |
| POST | `/api/admin/crm/pipelines` | `admin.crm.pipelines.create` | Session, role ≥ `manager` | 20/60_000 |
| DELETE | `/api/admin/crm/pipelines/{id}` | `admin.crm.pipelines.delete` | Session, role ≥ `manager` | 20/60_000 |
| GET | `/api/admin/crm/tags` | `admin.crm.tags.list` | Session, role ≥ `counsellor` | 60/60_000 |
| POST | `/api/admin/crm/tags` | `admin.crm.tags.create` | Session, role ≥ `manager` | 30/60_000 |
| DELETE | `/api/admin/crm/tags/{id}` | `admin.crm.tags.delete` | Session, role ≥ `manager` | 30/60_000 |
| GET | `/api/admin/crm/tasks` | `admin.crm.tasks.list` | Session, role ≥ `counsellor` | 60/60_000 |
| POST | `/api/admin/crm/tasks` | `admin.crm.tasks.create` | Session, role ≥ `counsellor` | 40/60_000 |
| PATCH | `/api/admin/crm/tasks/{id}` | `admin.crm.tasks.update` | Session, role ≥ `counsellor` | 40/60_000 |
| POST | `/api/admin/crm/tasks/{id}/complete` | `admin.crm.tasks.complete` | Session, role ≥ `counsellor` | 60/60_000 |
| POST | `/api/admin/crm/tasks/{id}/reassign` | `admin.crm.tasks.reassign` | Session, role ≥ `manager` | 40/60_000 |

### Cron

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/cron/run-due-jobs` | `cron.run_due_jobs` | `CRON_SECRET` bearer | 30/60_000 |

### Executive

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/executive/action-center` | `admin.executive.actionCenter.get` | Session, role ≥ `admin` | 30/60_000 |
| GET | `/api/admin/executive/dashboard` | `admin.executive.dashboard.get` | Session, role ≥ `admin` | 30/60_000 |

### Export

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| POST | `/api/admin/export` | `admin.export.request` | Session, role ≥ `admin` | 5/60_000 |
| GET | `/api/admin/export/{id}` | `admin.export.status` | Session, role ≥ `admin` | 30/60_000 |

### Files

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/files` | `admin.files.list` | Session, role ≥ `counsellor` | 60/60_000 |
| POST | `/api/admin/files` | `admin.files.upload` | Session, role ≥ `counsellor` | 20/60_000 |
| DELETE | `/api/admin/files/{id}` | `admin.files.delete` | Session, role ≥ `counsellor` | 20/60_000 |
| GET | `/api/admin/files/{id}` | `admin.files.get` | Session, role ≥ `counsellor` | 60/60_000 |
| GET | `/api/admin/files/{id}/download` | `admin.files.download` | Session, role ≥ `counsellor` | 60/60_000 |

### Health

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/health` | `health.check` | Public | 120/60_000 |
| GET | `/api/health/ready` | `health.ready` | Public | 60/60_000 |

### Integrations

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/integrations` | `admin.integrations.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/integrations/whatsapp/embedded-signup/complete` | `admin.integrations.whatsapp.embeddedSignup.complete` | Session, role ≥ `admin` | 10/60_000 |
| GET | `/api/admin/integrations/whatsapp/embedded-signup/config` | `admin.integrations.whatsapp.embeddedSignup.config` | Session, role ≥ `admin` | 30/60_000 |
| POST | `/api/admin/integrations/whatsapp/embedded-signup/disconnect` | `admin.integrations.whatsapp.embeddedSignup.disconnect` | Session, role ≥ `admin` | 10/60_000 |
| GET | `/api/admin/integrations/whatsapp/embedded-signup/status` | `admin.integrations.whatsapp.embeddedSignup.status` | Session, role ≥ `admin` | 60/60_000 |
| GET | `/api/admin/integrations/{providerId}` | `admin.integrations.get` | Session, role ≥ `admin` | 60/60_000 |
| GET | `/api/admin/integrations/{providerId}/availability` | `admin.integrations.calendar.availability` | Session, role ≥ `counsellor` | 30/60_000 |
| POST | `/api/admin/integrations/{providerId}/calendar-sync` | `admin.integrations.calendar.syncNow` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/integrations/{providerId}/calendars` | `admin.integrations.calendar.calendars` | Session, role ≥ `counsellor` | 30/60_000 |
| PUT | `/api/admin/integrations/{providerId}/config` | `admin.integrations.updateConfig` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/integrations/{providerId}/connect` | `admin.integrations.connect` | Session, role ≥ `admin` | 20/60_000 |
| DELETE | `/api/admin/integrations/{providerId}/credentials` | `admin.integrations.clearCredentials` | Session, role ≥ `admin` | 20/60_000 |
| PUT | `/api/admin/integrations/{providerId}/credentials` | `admin.integrations.setCredentials` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/integrations/{providerId}/disconnect` | `admin.integrations.disconnect` | Session, role ≥ `admin` | 20/60_000 |
| PATCH | `/api/admin/integrations/{providerId}/enabled` | `admin.integrations.setEnabled` | Session, role ≥ `admin` | 30/60_000 |
| GET | `/api/admin/integrations/{providerId}/logs` | `admin.integrations.logs.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/integrations/{providerId}/notification-test` | `admin.integrations.notifications.test` | Session, role ≥ `admin` | 10/60_000 |
| GET | `/api/admin/integrations/{providerId}/oauth/authorize` | `admin.integrations.calendar.oauthAuthorize` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/integrations/{providerId}/oauth/callback` | `admin.integrations.calendar.oauthCallback` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/integrations/{providerId}/webhook-url` | `admin.integrations.notifications.connectWebhookUrl` | Session, role ≥ `admin` | 20/60_000 |

### Jobs

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/jobs` | `admin.jobs.list` | Session, role ≥ `admin` | 60/60_000 |
| GET | `/api/admin/jobs/metrics` | `admin.jobs.metrics` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/jobs/{id}/cancel` | `admin.jobs.cancel` | Session, role ≥ `admin` | 30/60_000 |
| POST | `/api/admin/jobs/{id}/retry` | `admin.jobs.retry` | Session, role ≥ `admin` | 30/60_000 |

### Leads

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/leads` | `admin.leads.list` | Session, role ≥ `counsellor` | 60/60_000 |
| POST | `/api/admin/leads/bulk` | `admin.leads.bulk` | Session, role ≥ `manager` | 10/60_000 |
| GET | `/api/admin/leads/{id}` | `admin.leads.get` | Session, role ≥ `counsellor` | 60/60_000 |
| PATCH | `/api/admin/leads/{id}` | `admin.leads.update` | Session, role ≥ `counsellor` | 40/60_000 |
| POST | `/api/admin/leads/{id}/assign` | `admin.leads.assign` | Session, role ≥ `manager` | 40/60_000 |
| GET | `/api/admin/leads/{id}/insights` | `admin.leads.insights.list` | Session, role ≥ `counsellor` | 60/60_000 |
| POST | `/api/admin/leads/{id}/insights` | `admin.leads.insights.analyze` | Session, role ≥ `counsellor` | 10/60_000 |
| PUT | `/api/admin/leads/{id}/tags` | `admin.leads.set_tags` | Session, role ≥ `counsellor` | 40/60_000 |

### Marketing

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/marketing` | `admin.marketing.get` | Session, role ≥ `admin` | 60/60_000 |

### Meetings

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/meetings` | `admin.meetings.list` | Session, role ≥ `counsellor` | 60/60_000 |
| POST | `/api/admin/meetings` | `admin.meetings.schedule` | Session, role ≥ `counsellor` | 20/60_000 |
| DELETE | `/api/admin/meetings/{id}` | `admin.meetings.cancel` | Session, role ≥ `counsellor` | 20/60_000 |
| GET | `/api/admin/meetings/{id}` | `admin.meetings.get` | Session, role ≥ `counsellor` | 60/60_000 |
| PATCH | `/api/admin/meetings/{id}` | `admin.meetings.update` | Session, role ≥ `counsellor` | 20/60_000 |

### Notifications

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/notifications` | `admin.notifications.list` | Session, role ≥ `counsellor` | 60/60_000 |
| POST | `/api/admin/notifications/{id}/read` | `admin.notifications.read` | Session, role ≥ `counsellor` | 60/60_000 |

### Onboarding

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| POST | `/api/onboarding/organization` | `onboarding.organization.create` | Public or pre-org session | 10/15 * 60 * 1000 |
| GET | `/api/onboarding/plans` | `onboarding.plans.list` | Public or pre-org session | 60/60_000 |
| GET | `/api/onboarding/status` | `onboarding.status` | Public or pre-org session | 60/60_000 |
| POST | `/api/onboarding/steps/{id}` | `onboarding.steps.update` | Session, role ≥ `admin` | 60/60_000 |

### Payments

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/payments` | `admin.payments.list` | Session, role ≥ `manager` | 60/60_000 |
| POST | `/api/admin/payments` | `admin.payments.create` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/payments/analytics` | `admin.payments.analytics.get` | Session, role ≥ `manager` | 30/60_000 |
| GET | `/api/admin/payments/webhook-events` | `admin.payments.webhookEvents.list` | Session, role ≥ `manager` | 60/60_000 |
| GET | `/api/admin/payments/{id}` | `admin.payments.get` | Session, role ≥ `manager` | 60/60_000 |
| POST | `/api/admin/payments/{id}/check-status` | `admin.payments.checkStatus` | Session, role ≥ `manager` | 30/60_000 |
| POST | `/api/admin/payments/{id}/refund` | `admin.payments.refund` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/payments/{id}/retry` | `admin.payments.retry` | Session, role ≥ `admin` | 20/60_000 |

### Platform Admin

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/platform/audit-log` | `platform.auditLog.list` | Platform `super_admin` + MFA | 60/60_000 |
| GET | `/api/admin/platform/dashboard` | `platform.dashboard` | Platform `super_admin` + MFA | 30/60_000 |
| GET | `/api/admin/platform/health` | `platform.health` | Platform `super_admin` + MFA | 30/60_000 |
| GET | `/api/admin/platform/jobs` | `platform.jobs.list` | Platform `super_admin` + MFA | 60/60_000 |
| POST | `/api/admin/platform/jobs/{id}/cancel` | `platform.jobs.cancel` | Platform `super_admin` + MFA | 20/60_000 |
| POST | `/api/admin/platform/jobs/{id}/retry` | `platform.jobs.retry` | Platform `super_admin` + MFA | 20/60_000 |
| GET | `/api/admin/platform/onboarding` | `platform.onboarding` | Platform `super_admin` + MFA | 30/60_000 |
| GET | `/api/admin/platform/organizations` | `platform.organizations.list` | Platform `super_admin` + MFA | 60/60_000 |
| GET | `/api/admin/platform/organizations/{id}` | `platform.organizations.get` | Platform `super_admin` + MFA | 60/60_000 |
| POST | `/api/admin/platform/organizations/{id}/assign-plan` | `platform.organizations.assignPlan` | Platform `super_admin` + MFA | 20/60_000 |
| POST | `/api/admin/platform/organizations/{id}/extend-trial` | `platform.organizations.extendTrial` | Platform `super_admin` + MFA | 20/60_000 |
| POST | `/api/admin/platform/organizations/{id}/override-capability` | `platform.organizations.overrideCapability` | Platform `super_admin` + MFA | 20/60_000 |
| POST | `/api/admin/platform/organizations/{id}/override-limit` | `platform.organizations.overrideLimit` | Platform `super_admin` + MFA | 20/60_000 |
| POST | `/api/admin/platform/organizations/{id}/reactivate` | `platform.organizations.reactivate` | Platform `super_admin` + MFA | 20/60_000 |
| POST | `/api/admin/platform/organizations/{id}/suspend` | `platform.organizations.suspend` | Platform `super_admin` + MFA | 20/60_000 |
| GET | `/api/admin/platform/search` | `platform.search` | Platform `super_admin` + MFA | 60/60_000 |
| GET | `/api/admin/platform/security-events` | `platform.securityEvents.list` | Platform `super_admin` + MFA | 60/60_000 |

### Public

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/campaigns` | `campaigns.list` | Public | 60/60_000 |
| GET | `/api/docs/openapi.json` | `docs.openapi_spec` | Session, role ≥ `admin` | 30/60_000 |
| GET | `/api/docs/reference` | `docs.reference_ui` | Session, role ≥ `admin` | 30/60_000 |
| POST | `/api/leads` | `leads.create` | Public | 10/60_000 |
| POST | `/api/registrations` | `registrations.create` | Public | 10/60_000 |

### Registrations

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/registrations` | `admin.registrations.list` | Session, role ≥ `admin` | 60/60_000 |

### Scheduler

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| POST | `/api/admin/scheduler/run-due-jobs` | `scheduler.run_due_jobs` | Session, role ≥ `admin` | 60/60_000 |

### Settings

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/settings` | `admin.settings.get` | Session, role ≥ `admin` | 60/60_000 |

### System

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/system/preflight` | `admin.system.preflight` | Session, role ≥ `admin` | 30/60_000 |

### Team

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/team/invitations` | `admin.team.invitations.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/team/invitations` | `admin.team.invitations.create` | Session, role ≥ `admin` | 20/60 * 60_000 |
| POST | `/api/admin/team/invitations/{id}/resend` | `admin.team.invitations.resend` | Session, role ≥ `admin` | 20/60 * 60_000 |
| POST | `/api/admin/team/invitations/{id}/revoke` | `admin.team.invitations.revoke` | Session, role ≥ `admin` | 30/60_000 |

### Users

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/users` | `admin.users.list` | Session, role ≥ `manager` | 60/60_000 |
| POST | `/api/admin/users/{id}/revoke-sessions` | `admin.users.revokeSessions` | Session, role ≥ `admin` | 10/60_000 |

### Webhook Deliveries

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/webhook-deliveries` | `admin.webhook_deliveries.list` | Session, role ≥ `admin` | 60/60_000 |

### Webhook Endpoints

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/webhook-endpoints` | `admin.webhookEndpoints.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/webhook-endpoints` | `admin.webhookEndpoints.register` | Session, role ≥ `admin` | 20/60_000 |
| DELETE | `/api/admin/webhook-endpoints/{id}` | `admin.webhookEndpoints.delete` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/webhook-endpoints/{id}` | `admin.webhookEndpoints.get` | Session, role ≥ `admin` | 60/60_000 |
| PATCH | `/api/admin/webhook-endpoints/{id}` | `admin.webhookEndpoints.update` | Session, role ≥ `admin` | 20/60_000 |
| GET | `/api/admin/webhook-endpoints/{id}/deliveries` | `admin.webhookEndpoints.deliveries.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/webhook-endpoints/{id}/deliveries/{attemptId}/replay` | `admin.webhookEndpoints.deliveries.replay` | Session, role ≥ `admin` | 20/60_000 |
| PATCH | `/api/admin/webhook-endpoints/{id}/enabled` | `admin.webhookEndpoints.setEnabled` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/webhook-endpoints/{id}/rotate-secret` | `admin.webhookEndpoints.rotateSecret` | Session, role ≥ `admin` | 10/60_000 |
| POST | `/api/admin/webhook-endpoints/{id}/test` | `admin.webhookEndpoints.test` | Session, role ≥ `admin` | 10/60_000 |

### Webhooks

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| POST | `/api/webhooks/email` | `email.webhook.receive` | Provider signature | 300/60_000 |
| POST | `/api/webhooks/payments/{provider}` | `webhooks.payments.receive` | Provider signature | 120/60_000 |
| GET | `/api/webhooks/whatsapp` | `whatsapp.webhook.verify` | Provider signature | 20/60_000 |
| POST | `/api/webhooks/whatsapp` | `whatsapp.webhook.receive` | Provider signature | 300/60_000 |

### Whatsapp

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/whatsapp/phone-health` | `admin.whatsapp.phone_health.get` | Session, role ≥ `admin` | 60/60_000 |

### Whatsapp Campaigns

| Method | Route | Route name | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/admin/whatsapp-campaigns` | `whatsapp_campaigns.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/whatsapp-campaigns` | `whatsapp_campaigns.create` | Session, role ≥ `admin` | 30/60_000 |
| GET | `/api/admin/whatsapp-campaigns/stats` | `whatsapp_campaigns.stats` | Session, role ≥ `admin` | 60/60_000 |
| GET | `/api/admin/whatsapp-campaigns/templates` | `whatsapp_campaigns.templates.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/whatsapp-campaigns/templates` | `whatsapp_campaigns.templates.create` | Session, role ≥ `admin` | 30/60_000 |
| GET | `/api/admin/whatsapp-campaigns/{id}` | `whatsapp_campaigns.get` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/whatsapp-campaigns/{id}/archive` | `whatsapp_campaigns.archive` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/whatsapp-campaigns/{id}/audience` | `whatsapp_campaigns.resolve_audience` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/whatsapp-campaigns/{id}/cancel` | `whatsapp_campaigns.cancel` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/whatsapp-campaigns/{id}/clone` | `whatsapp_campaigns.clone` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/whatsapp-campaigns/{id}/import` | `whatsapp_campaigns.import_csv` | Session, role ≥ `admin` | 10/60_000 |
| GET | `/api/admin/whatsapp-campaigns/{id}/messages` | `whatsapp_campaigns.messages.list` | Session, role ≥ `admin` | 60/60_000 |
| POST | `/api/admin/whatsapp-campaigns/{id}/retry-failed` | `whatsapp_campaigns.retry_failed` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/whatsapp-campaigns/{id}/schedule` | `whatsapp_campaigns.schedule` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/whatsapp-campaigns/{id}/send` | `whatsapp_campaigns.send_now` | Session, role ≥ `admin` | 20/60_000 |
| POST | `/api/admin/whatsapp-campaigns/{id}/unarchive` | `whatsapp_campaigns.unarchive` | Session, role ≥ `admin` | 20/60_000 |

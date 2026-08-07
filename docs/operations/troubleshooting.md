# Troubleshooting Guide

**Status: current.** Real, known failure scenarios with safe diagnostic
steps — grounded in this app's actual mechanisms, not generic advice.
See also [`docs/operations/error-catalog.md`](error-catalog.md) and
[`docs/operations/support-diagnostics.md`](support-diagnostics.md).

---

## Login failure

1. Confirm the account exists and is `active`, not `disabled`
   (Platform Console → organization → users, or
   `GET /api/admin/users` for a tenant Admin).
2. Check for lockout: `MAX_FAILED_LOGIN_ATTEMPTS` (default 5) within
   `LOCKOUT_DURATION_SECONDS` (default 900s) — see
   [`docs/architecture/auth.md`](../architecture/auth.md#3--login--logout).
   The lockout clears automatically after the window; there is no
   manual "unlock" route today (see §12 of `DR_RUNBOOK.md` for the
   related disclosed gap on admin-triggered force-password-reset).
3. If MFA-enabled: confirm the account isn't stuck expecting a TOTP
   code from an app the user lost — email-OTP fallback
   (`POST /api/auth/mfa/request-email-otp`) is the recovery path, not a
   password reset.
4. Check `GET /api/auth/login-history` for the account — shows recent
   attempts and their outcome.

## OTP / verification email not received

1. **Local dev**: check the dev server's own console output — the
   `console` email provider logs the full message including the link
   (`[email:console] -> ...`), it never actually sends. This is
   expected, not a bug, when `EMAIL_PROVIDER=console`.
2. **Real deployment**: confirm `EMAIL_PROVIDER=postmark` and
   `EMAIL_POSTMARK_SERVER_TOKEN` are actually set (`GET
   /api/admin/system/preflight` reports this).
3. Check spam/junk — this app doesn't control inbox placement.
4. Rate-limited resend: `POST /api/auth/resend-verification` is
   limited to 5/15min — a rapid double-click looks like "nothing
   happened" but is actually a suppressed duplicate request.

## WhatsApp disconnected

1. Check the real status: Settings → Integrations → WhatsApp, or
   `GET /api/admin/integrations/whatsapp/embedded-signup/status`.
   This reports the **real** tenant connection state — never
   fabricates "connected."
2. Common real cause: a Meta-side token expiry or the customer revoking
   app access on Facebook's own Business settings — reconnect via
   "Connect WhatsApp" again (Embedded Signup), not a manual token
   paste.
3. Confirm this is a **tenant** connection issue, not a platform
   configuration issue — see
   [`docs/integrations/matrix.md`](../integrations/matrix.md#2--whatsapp)
   for the platform-vs-tenant distinction. If EVERY organization is
   affected, check the platform's own Meta App config
   (`WHATSAPP_META_APP_ID` etc.), not one tenant's connection.

## Meta webhook failure

1. Check `GET /api/admin/webhook-deliveries` — every inbound WhatsApp
   webhook call is logged here, recognized or not.
2. A `401` on the webhook route means signature verification failed —
   confirm `WHATSAPP_META_APP_SECRET` matches the Meta App actually
   sending the webhook (a secret mismatch, not a code bug, is the
   overwhelming likely cause).
3. See [`docs/api/webhooks.md`](../api/webhooks.md#1--inbound-webhooks)
   for the exact verification mechanism.

## Template unavailable

1. Templates sync from Meta on a periodic scheduler job
   (`TEMPLATE_SYNC_JOB_TYPE`) — a newly-created template in Meta's own
   Business Manager may not appear until the next sync tick.
2. Check the template's own `status` field in the Templates table — a
   real `"unknown"`/`"rejected"`/`"pending"` status from Meta is
   surfaced honestly, never assumed `"approved"`.

## Campaign stuck

1. Check `GET /api/admin/whatsapp-campaigns/stats` and the campaign's
   own status — a campaign in `"sending"` with no progress for an
   extended period suggests the scheduler isn't draining jobs.
2. Check queue health: `/admin/reliability` or
   `GET /api/admin/jobs/metrics` — a growing pending-job count with no
   completions means the cron trigger itself may not be firing (check
   Vercel Cron's own execution log) or `CRON_SECRET` is misconfigured.
3. A campaign with individual failed message attempts (not the whole
   campaign stuck) — `POST /api/admin/whatsapp-campaigns/[id]/retry-failed`
   retries just those.

## Automation failed

1. Check the specific `WorkflowRun`'s status
   (`GET /api/admin/automation/runs`) — `"failed"` runs carry the
   real failure reason from whichever step/action rejected.
2. A single failed action retries via the scheduler's own backoff
   before the run is marked `failed` — a run failing immediately
   (not after retries) usually means a genuinely invalid
   configuration (e.g. a `send_email` step with no configured email
   provider), not a transient issue.

## Queue backlog / DLQ growth

1. `/admin/reliability` — real-time pending/dead-lettered counts.
2. Confirm Vercel Cron is actually invoking
   `/api/cron/run-due-jobs` on schedule (check Vercel's own cron
   execution history) — a backlog with zero recent executions points
   at the cron trigger, not the job logic.
3. See `RUNBOOK.md` §9 and `DR_RUNBOOK.md` §10 for per-job-type
   replay-safety classification before manually retrying a
   dead-lettered job — some job types are explicitly **not** safe to
   blindly replay (a real WhatsApp send, a webhook delivery).

## Email failure

1. Confirm `EMAIL_PROVIDER` — `console` never actually sends (expected
   in local dev, a real misconfiguration in production).
2. `sendgrid`/`resend` are disclosed **scaffolds** — selecting either
   throws `EmailProviderNotImplementedError` on every send attempt,
   by design, not a bug. Only `postmark` is a real implementation
   today.
3. Check Postmark's own delivery dashboard for a bounce/suppression —
   this app doesn't currently surface Postmark's own bounce
   webhooks back into the UI.

## AI unavailable

1. This is very often the **correct, honest state**, not a bug — an
   AI feature with no `AI_PROVIDER`/vendor key configured (platform or
   tenant) always shows a real "unavailable" state, never a fabricated
   result. See [`docs/integrations/ai.md`](../integrations/ai.md#6--failure--fallback-behavior).
2. If a key IS configured and it's still unavailable: check for a real
   vendor rejection (`LeadInsight`/`ConversationInsight`'s own `status:
   "error"` row carries the vendor's actual error message) — an
   invalid/expired API key is the common real cause.
3. Confirm the organization's plan includes AI capability, and hasn't
   exhausted its AI request usage limit (Module 8.3) — both produce a
   real rejection before the vendor is ever called.

## Payment webhook failure

1. A `401` means signature verification failed for that provider — see
   [`docs/api/webhooks.md`](../api/webhooks.md#1--inbound-webhooks).
   Confirm the provider's webhook secret env var matches what's
   registered in that provider's own dashboard for this environment.
2. Check `GET /api/admin/payments/webhook-events` for the real,
   recorded event log (including ones that failed signature checks).
3. A payment stuck in a non-terminal status:
   `POST /api/admin/payments/[id]/check-status` re-queries the
   provider directly rather than waiting for another webhook.

## Storage failure

1. Confirm `STORAGE_PROVIDER` isn't `local` in a production/serverless
   deployment — this is explicitly unsupported there (read-only
   filesystem, non-durable `/tmp`). See
   [ADR-0004](../development/adr/0004-vercel-serverless-deployment.md).
2. A large upload rejected by the platform itself (not this app's own
   validation) — check against Vercel's own platform-level request-body
   ceiling, a known, disclosed gap (this app's own per-category limits
   go up to 50MB, which can exceed the platform's own ceiling).
3. Cloudinary private-file delivery is a disclosed, unimplemented gap —
   use AWS S3 for any deployment needing private files.

## Something not listed here

Check `GET /api/admin/system/preflight` first — it reports real,
current health across Database/Auth/Encryption/Queue/Cron/Workers/
Storage/Observability plus every tenant integration's configured
state, in one place, before assuming anything is broken vs. simply
unconfigured.

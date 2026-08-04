# WhatsApp Integration — Architecture Audit

**Status: Audit only — and largely acted on since.** This document's
§2 gap analysis (Bulk Messaging Engine, Message Queue, Delivery/Read
Status persistence, Campaign Support, the missing Repository Layer)
became `CAMPAIGN_ARCHITECTURE.md`'s scope, approved and implemented —
see that document and `CHANGELOG.md`'s "WhatsApp Campaign Manager"
entry. The rest of this audit (the parts already marked ✅ — the Meta
adapter, provider abstraction, webhook verification, templates,
sessions, logging, error handling) was correctly identified as already
solid and was reused as-is, not rebuilt.

This audits what already exists against your 15 requirements, in the
order you listed them. Every claim below is backed by a specific file
read directly, not inferred from a module name or a comment — where a
comment turned out to describe something that no longer matches the
code, that's called out explicitly (see §3, "Documentation drift found
during this audit").

---

## 1. What already exists

WhatsApp integration was built across three prior modules in this
codebase's history: **"WhatsApp Provider Architecture"** (the
abstraction, scaffolded vendors), **"Meta WhatsApp Cloud API
Integration"** (the one real, working adapter), and **"Automation
Engine"** (which, despite its name suggesting it's unrelated, is the
only current caller of the WhatsApp service). Nothing below needs to be
recreated.

### Official Meta WhatsApp Cloud API — ✅ real, working implementation
`lib/services/whatsapp/providers/metaCloudApi.provider.ts`. Sends via
Meta's Graph API (`messaging_product`/`to`/`type` envelope), both text
and template messages. Verifies inbound webhooks with HMAC-SHA256 over
the raw request body, using `timingSafeEqual` (not `===`) specifically
to avoid leaking signature-match information through response-time
differences. Fails closed if `WHATSAPP_META_APP_SECRET` isn't
configured — refuses to accept unverifiable webhooks rather than
silently trusting them.

### Provider abstraction — ✅ complete, real dependency inversion
`lib/services/whatsapp/types.ts`'s `WhatsAppProvider` interface is the
seam; `lib/services/whatsapp/registry.ts` is the **only** file in the
codebase allowed to import a concrete adapter (enforced by convention +
`index.ts`'s barrel deliberately not exporting the registry or any
adapter). Six providers registered: `console` (dev default — logs and
returns a synthetic success, no network call), `meta-cloud-api` (real),
and four scaffolded stubs (`aisensy`, `interakt`, `wati`, `gallabox` —
each throws `WhatsAppProviderNotImplementedError` when actually called,
with an illustrative request sketch in a comment for whoever integrates
them later).

### Environment variables — ✅ complete
`config/whatsapp.ts`. Server-only (no `NEXT_PUBLIC_` prefix — these
must never reach the browser bundle). `WHATSAPP_PROVIDER` falls back to
`"console"` if unset or invalid, so the app never fails to build or run
without a vendor configured. Per-vendor credential blocks for all six
providers already exist, populated or blank in `.env.local`.

### Webhook verification — ✅ complete, both directions
- **GET** (`app/api/webhooks/whatsapp/route.ts`): Meta's one-time
  `hub.mode`/`hub.verify_token`/`hub.challenge` handshake, echoing back
  the raw challenge string (not JSON) on success, `403` on mismatch.
- **POST**: HMAC `X-Hub-Signature-256` verification (see above) before
  anything in the body is trusted; `401` on an invalid/missing
  signature, not a silent drop — a real misconfiguration should surface
  as visible repeated failures.

### Template Messages — ✅ complete
`WhatsAppProvider.sendTemplate()` at the provider layer;
`whatsappService.sendRegistrationConfirmation()`,
`sendCohortReminder()`, and the generic `sendTemplateMessage()` at the
business layer. Every vendor requires business-initiated messages to
use a pre-approved template outside a 24-hour customer-service window —
this shape (template name, language, ordered variables) is the common
denominator every adapter translates into its own vendor-specific
payload.

### Session Messages — ✅ complete, correctly scoped
`sendText()` / `whatsappService.sendPlainText()` — free-form text,
documented (correctly) as only deliverable inside a vendor's 24-hour
window, i.e. after the recipient has messaged first. Not usable as
first contact; that's what Template Messages are for. This distinction
is real and enforced by every vendor's own API, not just a comment here.

### Logging — ✅ complete
Structured, via the shared `lib/logger.ts` primitive (the same one
every other module in this codebase uses) — send attempts, send
failures (with vendor error code/message), webhook signature failures,
webhook verification rejections, unrecognized status values (skipped,
not thrown on).

### Error Handling — ✅ complete, deliberately two-tiered
`WhatsAppError` (types.ts) — an expected, normal send failure (bad
number, vendor outage), carries a `retryable` flag the retry layer
reads. `WhatsAppProviderNotImplementedError` (errors.ts) — a
configuration/setup gap, meant to fail loudly during development rather
than be swallowed as a quiet "failed" result. Meta adapter classifies
`429`/`5xx` as retryable, `4xx` (e.g. an unapproved template name) as
not — retrying a malformed request wouldn't fix it.

### Service Layer — ✅ complete
`whatsappService` (`lib/services/whatsapp/whatsappService.ts`) —
business-named methods (`sendRegistrationConfirmation`,
`sendCohortReminder`, `sendTemplateMessage`, `sendPlainText`,
`verifyWebhookChallenge`, `parseWebhookEvent`). The only module a caller
should import — `index.ts`'s barrel doesn't export the registry, any
adapter, or `queue.ts`'s `processSendJob` directly.

### Failed Message Retry — ✅ exists, at two distinct layers (see §2 for the gap)
- **Immediate, in-process**: `lib/services/whatsapp/retry.ts`'s
  `withRetry()` — exponential backoff (500ms base, 3 attempts),
  used by the Meta adapter for a single HTTP call's transient failures.
  Seconds, not persisted.
- **Persisted, cross-invocation**: the Automation Engine's
  `WorkflowStep.retryPolicy` — linear backoff *across real wall-clock
  time* between polled attempts, surviving a serverless function being
  torn down between them. Used today by `leadNurtureSequence.ts`'s
  three WhatsApp-sending steps (2–3 attempts each, 15–30 min backoff).

---

## 2. What's missing, and why each one matters

### Bulk Messaging Engine — ❌ missing
Every send in this codebase is single-recipient
(`WhatsAppRecipient` is exactly one phone number). There is no "send
this template to these 500 leads" primitive anywhere — not in
`whatsappService`, not in the Automation Engine (which starts one
workflow *run per lead*, individually, in response to that lead's own
`lead.created` event — it was never designed as a broadcast tool, and
extending it to be one would blur what it's for).
**Why it's needed:** a CRM's WhatsApp integration is only as useful as
its ability to reach a *segment* at once (e.g. "everyone who registered
for Program X but hasn't attended a session yet") without a human
manually triggering 500 individual sends.

### Message Queue architecture — ⚠️ scaffolded, not real
`lib/services/whatsapp/queue.ts`'s `processSendJob()` takes a
plain, serializable `WhatsAppSendJob` object — deliberately shaped so a
real queue producer/consumer pair could sit on either side of it without
this function changing. Today, `whatsappService` calls it directly and
synchronously ("a queue of one, run now"). There is no actual queue
(no Redis/SQS/BullMQ/etc.), no persistence of a pending job if the
process dies mid-send, and no worker process separate from the request
that enqueued it.
**Why it's needed:** a Bulk Messaging Engine (above) sending hundreds of
messages inline, synchronously, in a single request would either time
out the request or hammer the vendor's rate limits — it needs to enqueue
and drain asynchronously.

### Delivery Status / Read Status — ⚠️ received and parsed, never persisted
The webhook POST handler correctly verifies, parses, and logs every
inbound `sent`/`delivered`/`read`/`failed` status event
(`extractStatusEvents()` in the Meta adapter) — but only to the
operational log (`logger.info`), a line in stdout. **Nothing writes
these events to a database.** There is no `Message`/`MessageStatus`
model or repository anywhere in `lib/db`. This means: there is no way
to answer "did message X get delivered?" or "has this lead read our
last message?" after the fact — only by grepping logs, which isn't a
real query surface.
**Why it's needed:** you explicitly asked for Delivery Status and Read
Status as distinct requirements from Logging — that only makes sense if
they're queryable, not just logged. A CRM dashboard view of "message
history per lead" (a natural companion to the CRM Dashboard UI already
built) needs this.

### Failed Message Retry — ⚠️ real for workflow steps, absent for one-off sends
If a call to `whatsappService.sendRegistrationConfirmation()` (a
plain, non-workflow call — e.g. from a future registration-confirmation
flow) fails after the Meta adapter's 3 immediate attempts are exhausted,
that failure is final. Nothing retries it later. The Automation Engine's
persisted retry only covers sends that happen to be *workflow steps*
(today, exactly the three steps in `leadNurtureSequence.ts`) — it's not
a general facility every send benefits from.
**Why it's needed:** without a Message repository (above) recording
"this send failed and hasn't been retried," there's nothing to drive a
later retry attempt from — this gap and the persistence gap are the
same root cause.

### Message Scheduling — ⚠️ exists narrowly, not wired to run
`WorkflowStep.delay` genuinely does implement scheduled/delayed sends
— persisted, serverless-safe (a `nextRunAt` field + `runDueWorkflowSteps()`
polls for what's due). But: (1) it's scoped to steps *inside* a defined
workflow, not a general "send this WhatsApp message at time T" API any
caller can use standalone, and (2) — this is the more significant gap —
**`runDueWorkflowSteps()` is not wired to anything.** No cron, no
scheduled trigger, nothing currently calls it in production. The
scheduling logic is real; the clock that would drive it doesn't exist
yet.
**Why it's needed:** without a scheduler actually invoking
`runDueWorkflowSteps()`, every delayed step in every workflow — the
Reminder and Offer steps in the one example workflow that exists — never
actually fires outside of a manual test call.

### Campaign Support — ❌ missing (in the WhatsApp-broadcast sense)
The `Campaign` entity that already exists (Module 5) is a **marketing
attribution** concept — UTM tracking, ad spend, channel, budget,
registration-count-per-campaign. It has nothing to do with "a named
batch of WhatsApp messages sent to a list of recipients, trackable as
one unit." There is no WhatsApp-specific campaign concept anywhere.
**Why it's needed:** this is what a Bulk Messaging Engine needs a name
for — "the July Cohort Reminder blast," not just an anonymous list of
500 individual sends with no shared identity to report on later
(how many delivered, how many read, as a campaign-level rollup).

### Repository Layer for WhatsApp — ❌ missing entirely
No `Message`, `MessageTemplate`, or `WhatsAppCampaign` model/repository
exists in `lib/db`. This is the one gap almost every other gap above
depends on: Delivery/Read Status querying, a general Failed-Message-Retry
facility, a Bulk Messaging Engine's job tracking, and Campaign Support
all need *something* persisted to work against.

---

## 3. Documentation drift found during this audit

Two existing comments no longer match the code they're describing —
noted here since accurate docs matter for anyone extending this later,
not fixed yet (no code changes made during this audit):

- `lib/services/whatsapp/whatsappService.ts`'s top comment says: *"Not
  yet called from anywhere in the app: the leadService/
  registrationService integration this was built for is a deliberate
  follow-up decision, not made here."* This is now false —
  `lib/services/automation/workflows/leadNurtureSequence.ts` calls
  `whatsappService.sendTemplateMessage()` from all three of its steps.
  The integration point ended up being the Automation Engine, not
  `leadService`/`registrationService` directly.
- `lib/services/automation/triggers.ts`'s comment says
  `registerAutomationTriggers()` is *"Called once from
  instrumentation.ts at server startup."* `instrumentation.ts` was
  removed (Authentication module) after a real bug was found in that
  approach — the actual mechanism now is `lib/events/eventBus.ts`'s
  self-bootstrapping `ensureBootstrapped()`, triggered from inside
  `publish()` itself. The comment in `triggers.ts` still describes the
  old, removed mechanism.

---

## 4. Proposed extension — preview only, not started

If approved, the shape I'd build, reusing everything above rather than
replacing it:

- **`lib/db/models/message.model.ts` + repository** (mongo + in-memory,
  same dual pattern as every other entity): one row per outbound send
  attempt — recipient, template/text used, provider, providerMessageId,
  status (`queued`/`sent`/`delivered`/`read`/`failed`), timestamps,
  `campaignId?`. The webhook POST handler would look up a row by
  `providerMessageId` and update its status instead of only logging it.
- **`lib/db/models/whatsappCampaign.model.ts` + repository**: a named
  batch — recipient list (probably a saved Lead/Registration filter,
  reusing the Admin Dashboard Backend's existing filter shapes rather
  than inventing a new segmentation concept), template, schedule time,
  status, and aggregate counts rolled up from `Message` rows.
  Deliberately a *different* entity from the existing `Campaign`
  (marketing attribution) — conflating the two would make an already
  export-heavy admin surface `it can create` ambiguous about which
  "campaign" a screen means.
- **A real send queue**: given no message-broker infrastructure exists
  anywhere else in this app either, the pragmatic first step is a
  persisted `Message` row with `status: "queued"` plus a poller
  (`processQueuedMessages()`, same shape as `runDueWorkflowSteps()`) —
  not a new piece of infrastructure, the same "queue of one, polled"
  pattern already proven out by the Automation Engine, extended to
  WhatsApp sends generally instead of only workflow steps.
- **Wiring a scheduler**: `runDueWorkflowSteps()` and the new
  `processQueuedMessages()` both need *something* to call them on a
  timer. This needs a decision from you (a Vercel Cron hitting an
  authenticated route is the lowest-effort option given this app's
  current hosting-agnostic design, but it's your call).
- **Bulk send entry point**: a `whatsappCampaignService.sendCampaign()`
  that resolves a recipient list, creates one `Message` row per
  recipient (`status: "queued"`), and lets the poller above drain them —
  reusing `processSendJob()`'s existing per-message logic rather than
  duplicating it.

None of this touches the existing provider abstraction, the Meta
adapter, webhook verification, or the Automation Engine's own retry/
delay mechanics — it's additive: new entities, a new service, one new
poller, and the webhook handler gaining a database write it doesn't have
today.

## 5. Open questions before implementation

1. Should the new "queued" message poller be a **separate** mechanism
   from the Automation Engine's `runDueWorkflowSteps()`, or should
   workflow-step sends (like the existing nurture sequence) be migrated
   onto the *same* `Message`-row-backed queue, so there's one delivery
   pipeline instead of two? (My inclination is: keep them separate for
   now — workflow steps aren't only WhatsApp sends, a step can do
   anything — but unify later if a second queued-thing appears.)
2. Recipient segmentation for Bulk Messaging: reuse the existing
   Lead/Registration list filters (Admin Dashboard Backend already has
   these), or do you want a distinct saved-audience concept?
3. Scheduler mechanism (Vercel Cron vs. something else) — this affects
   both the new message queue and the already-built-but-never-triggered
   `runDueWorkflowSteps()`.

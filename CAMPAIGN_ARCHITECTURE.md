# WhatsApp Campaign Management — Architecture

**Status: Approved and implemented.** See `CHANGELOG.md`'s "WhatsApp
Campaign Manager" entry for the full file list and live verification.
The five approved decisions (Papa Parse; 5,000-row CSV cap;
single shared scheduling infrastructure; 3-attempt/1-5-15-minute retry
policy; separate `whatsappCampaignService` bounded context) plus the
`MessageAttempt` addition were all incorporated exactly as approved —
notable implementation findings from that process:

- The shared scheduler (§7 below) ended up needing a genuine
  `JobOutcome` contract (`completed`/`reschedule`/`failed`) rather than
  a single fixed retry policy applied to every job type — the
  Automation Engine's existing per-step retry semantics couldn't be
  forced into one policy without a real behavior change to already-
  working code. The Automation Engine was wired onto the shared queue
  as a self-rescheduling "tick" job that wraps its own
  `runDueWorkflowSteps()` completely unchanged — zero lines touched in
  `engine.ts`/`triggers.ts`/the workflow definitions.
- Live testing (an intentionally invalid Meta access token, the same
  technique used when the Meta Cloud API adapter was first built)
  caught a real gap during verification, not after: a genuinely
  non-retryable failure (e.g. an invalid token, a 401) was correctly
  failing after 1 attempt rather than 3 — the *test's* assumption that
  every failure exhausts all 3 attempts was wrong, not the code
  (retrying an auth failure with the same bad token 3 times would be
  pointless). Caught and corrected in the test, not the implementation.
- Cancelling a "sending" campaign was initially going to be documented
  as a known limitation (in-flight message jobs wouldn't check the
  campaign's status). Reconsidered during implementation and fixed
  properly instead — see §14/CHANGELOG.

This is a direct continuation of `WHATSAPP_ARCHITECTURE.md` (the prior
audit), which already identified "Bulk Messaging Engine," "Message
Queue," "Delivery/Read/Failed Analytics," "Failed Message Retry,"
"Message Scheduling," and "Campaign Support" as gaps and sketched a
preview extension. This document takes that preview and turns it into
a complete, decision-by-decision production architecture, scoped
specifically to Campaign Management, per your 18 requirements.

---

## 1. Audit: what already exists

Re-verified directly against the code (not assumed from the prior
audit) before writing anything below:

- **No WhatsApp campaign concept exists anywhere.** The `Campaign`
  entity (`lib/services/campaigns`, `lib/db/models/campaign.model.ts`)
  is marketing attribution — UTM source/medium/campaign, channel,
  budget, `registrationCount`. It answers "which acquisition channel
  produced this lead," not "send this message to these 500 people."
  Zero fields, methods, or concepts overlap with what a bulk-send
  campaign needs (recipients, message content, delivery tracking).
- **No CSV *import* capability anywhere.** `lib/api/csv.ts`'s `toCsv()`
  is serialization-only (used by every Admin Dashboard Backend export
  button). There is no CSV parser, no file-upload handling, no
  dependency for either (`grep` for `csv-parse`/`papaparse`/`multipart`
  across the codebase returns nothing but the existing export routes'
  own `?format=csv` query-string handling).
- **No segmentation/audience concept exists.** No saved-filter, no
  "list," no audience model. What *does* exist and is directly reusable:
  `LeadListFilters`/`RegistrationListFilters` (Admin Dashboard Backend)
  — the same filter shapes the CRM Dashboard UI's Leads/Registrations
  pages already use for search/filter/pagination.
- **No `Message` or delivery-tracking model.** Confirmed again: nothing
  under `lib/db/models` for WhatsApp messages. The webhook handler logs
  status events and discards them.
- **The reusable primitives that already exist and this design leans on
  heavily:**
  - `whatsappService`/`processSendJob()`/the provider abstraction —
    campaign sends should be individual calls into this, not a parallel
    sending path.
  - The Automation Engine's `WorkflowRun` pattern — **persisted state +
    `nextRunAt` + a poller function** — is this codebase's only proven
    answer to "something needs to happen later, correctly, even though
    serverless functions don't stay alive." Campaign scheduling and the
    campaign send queue both reuse this exact pattern rather than
    inventing a second one.
  - The Admin Dashboard Backend's pagination (`lib/pagination.ts`,
    `lib/api/pagination.ts`) and CSV export (`lib/api/csv.ts`) —
    Campaign History and Analytics listings reuse these directly.
  - `lib/api/withApiRoute.ts`'s `requiredRole`/rate-limiting/logging —
    every new route uses this, same as every existing admin route.

**The central scoping decision, stated once, up front, because it
affects every section below:** the new entity is **`WhatsAppCampaign`**
— deliberately not an extension of the existing `Campaign` model.
Reusing `Campaign` would conflate "which UTM source drove this lead"
with "which message blast this lead received," force a `Campaign` row
to carry recipient lists and message content it has no other reason to
have, and make every existing Campaign Tracking screen ambiguous about
which kind of "campaign" it's showing. They can *reference* each other
(a `WhatsAppCampaign` may optionally carry a `marketingCampaignId` so a
WhatsApp blast can be attributed back to a marketing campaign in
reporting) without being the same thing.

---

## 2. Missing functionality, and why each is required

| Requirement | Status | Why it's needed |
|---|---|---|
| Campaign Creation | Missing | The entry point for everything else — nothing to schedule, segment, or send without it |
| Audience Selection | Missing | A campaign needs to know *who* — reusing existing Lead/Registration filters (see §1) rather than inventing new segmentation primitives |
| Contact Segmentation | Partial (filters exist, no saved/reusable segment concept) | Marketers reuse the same audience definitions repeatedly ("all active leads in Program X") — recomputing filters by hand every time invites mistakes |
| CSV Import | Missing | Not every audience is a query against existing data — a marketer's own external list (an event sign-up sheet, a partner's referral list) needs a path in |
| Schedule Campaign | Missing (mechanism exists in Automation Engine, unwired for this use) | A campaign sent "now" during business hours vs. queued for 9am tomorrow when open rates are higher is a real, common marketing need |
| Immediate Send | Missing | The simplest, most common path — should not require going through scheduling machinery to fire right away |
| Campaign History | Missing | Without a persisted `WhatsAppCampaign` row, there is nothing to list — this is the direct consequence of the "no campaign entity" gap in §1 |
| Delivery Analytics | Missing | Requires the `Message` model (§1) — without persisted per-recipient status, there's nothing to aggregate |
| Read Analytics | Missing | Same root cause as Delivery Analytics |
| Failed Analytics | Missing | Same root cause — additionally needs a failure *reason*, not just a count, to be actionable |
| Retry Failed | Missing | Today, a failed send (after the Meta adapter's own immediate 3-attempt exponential backoff is exhausted) is final. At campaign scale (hundreds/thousands of recipients), some failures are expected and transient (rate limiting, a momentary vendor blip) — an operator needs to re-attempt just the failed subset, not resend to everyone |
| Campaign Status | Missing | The lifecycle state (draft/scheduled/sending/completed/failed/cancelled) that every other feature above reports against or acts on |
| Campaign Templates | Partial (`WhatsAppTemplatePayload` exists as a per-send shape; no saved/reusable template record) | A marketer picks from templates they've already gotten Meta-approved, repeatedly — re-typing a template name and variable order by hand every campaign is exactly the kind of friction a real tool removes |
| Campaign Scheduling | Missing (see Schedule Campaign) | Listed as its own line item in your requirements — treated as the same underlying capability as "Schedule Campaign" in this design, documented together in §4 |
| Campaign Queue | Scaffolded only (`processSendJob`, synchronous) | Sending to hundreds/thousands of recipients inline in one request would time out and ignore vendor rate limits — needs to be queued and drained incrementally |
| Bulk Send Pipeline | Missing | The mechanism that actually walks a campaign's recipient list and sends, respecting pacing/rate limits and recording per-recipient outcome |
| Service Layer | N/A yet | New — `campaignManagerService` (or similar), described in §3 |
| Repository Layer | Missing | `WhatsAppCampaign`, `CampaignRecipient`/`Message` need the same dual mongo/in-memory repository pattern every other entity in this codebase already uses |

---

## 3. Database design review

### New entities

#### `WhatsAppCampaign`
```
id
name                        — operator-facing label, e.g. "July Cohort Reminder"
status                      — "draft" | "scheduled" | "sending" | "completed" | "failed" | "cancelled"
templateId                  — references CampaignTemplate (below)
templateVariablesMapping    — how a recipient's own data fills the template's {{1}}, {{2}}... (e.g. "name" -> recipient field)
audienceSource              — "filter" | "csv_import" | "manual"
audienceSnapshotAt          — when the recipient list was resolved (see §5 — always a snapshot, never a live query at send time)
scheduledFor?               — ISO timestamp; absent means "send immediately once queued"
marketingCampaignId?        — optional reference to the existing (unrelated) Campaign entity, for attribution reporting only
recipientCount              — denormalized total, set once the audience is resolved
sentCount / deliveredCount / readCount / failedCount  — denormalized rollups, updated as Message rows change status (see §9 — why denormalized, not always-aggregated-on-read)
createdAt / updatedAt
```

#### `CampaignTemplate`
```
id
name                        — internal label
metaTemplateName            — the actual Meta-approved template name
languageCode
variableLabels               — ordered list of human-readable names for each {{n}} slot, purely for the create-campaign UI/API's own validation — the actual send still goes through the existing WhatsAppTemplatePayload shape
createdAt / updatedAt
```
A thin, deliberately small record — this does not duplicate anything
about *how* a template is sent (that's still `WhatsAppTemplatePayload` /
`WhatsAppProvider.sendTemplate()`, untouched). It exists so a campaign
can reference a template by a stable id instead of a marketer retyping
a template name correctly every time.

#### `Message` (the per-recipient send + delivery record)
```
id
campaignId?                  — absent for a non-campaign send (e.g. a future direct registration-confirmation call) — Message is useful independent of Campaign Management, per the prior audit doc's §2
recipientPhoneE164
recipientName?
leadId? / registrationId?    — best-effort back-reference, when the recipient came from an existing Lead/Registration rather than a raw CSV row
templateId?
status                       — "queued" | "sending" | "sent" | "delivered" | "read" | "failed"
provider                     — which WhatsAppProviderId actually handled this send
providerMessageId?           — set once sent; the webhook matches on this to update status
failureReason?
attempts                     — retry counter (see §7)
queuedAt / sentAt? / deliveredAt? / readAt? / failedAt?
createdAt / updatedAt
```

#### `CampaignRecipient` — considered and deliberately *not* a separate
entity. A `Message` row with `campaignId` set already *is* "a recipient
of this campaign, plus their outcome" — a separate `CampaignRecipient`
list would just duplicate the same rows `Message` already needs to
exist for delivery tracking. One entity, not two.

### Indexes

- `WhatsAppCampaign`: `{ status: 1 }` (campaign history filtering, and
  the scheduler's "find campaigns due to start" query — see §4),
  `{ scheduledFor: 1 }` (the scheduler's own due-query, same shape as
  `WorkflowRun.nextRunAt`'s existing index).
- `Message`: `{ campaignId: 1, status: 1 }` (compound — the analytics
  queries in §8 are always "for this campaign, count by status"),
  `{ providerMessageId: 1 }` (the webhook's lookup-and-update path — the
  single most frequent query against this collection once volume is
  real), `{ status: 1, queuedAt: 1 }` (the bulk-send poller's "find
  queued messages ready to send" query, same shape as
  `RefreshTokenRepository`/`WorkflowRunRepository`'s existing due-query
  indexes).

### Why dual repositories (mongo + in-memory) again
Same reasoning as every other entity in this codebase: `MONGODB_URI` is
optional, and the app must never fail to build/run without it
configured. Nothing about campaign management changes that constraint.

---

## 4. Campaign lifecycle

```
draft ──(audience resolved + template chosen)──> ready
ready ──(Send Now)────────────────────────────────> sending
ready ──(Schedule for time T)──────────────────────> scheduled
scheduled ──(T arrives, poller picks it up)────────> sending
sending ──(every Message reaches a terminal state)─> completed
sending ──(operator cancels)────────────────────────> cancelled  [in-flight messages already sent are not un-sent; queued ones are not sent]
scheduled ──(operator cancels before T)─────────────> cancelled
```

`completed` does not mean "everything delivered" — it means every
`Message` row reached a terminal status (`delivered`, `read`, or
`failed`). A campaign can be `completed` with a nonzero `failedCount`;
that's what Failed Analytics + Retry Failed are for (§7/§8), not a
reason to keep the campaign "in progress" indefinitely.

There is no `draft` → `ready` transition validation beyond "audience
resolved and template chosen" deliberately — no approval workflow, no
multi-step review gate. Not requested, and adding one would be scope
beyond what you asked for.

---

## 5. Audience segmentation strategy

Three sources, one resolution rule:

1. **`filter`** — the existing `LeadListFilters`/`RegistrationListFilters`
   shapes (Admin Dashboard Backend), already proven, already what the
   CRM Dashboard UI's Leads/Registrations pages use. No new
   segmentation DSL invented.
2. **`csv_import`** — see §6.
3. **`manual`** — a directly-supplied list of phone numbers (the
   escape hatch for "these 12 specific people," not worth a filter or a
   CSV).

**The resolution rule, stated once because it matters for correctness:**
regardless of source, the audience is resolved into a concrete set of
`Message` rows (`status: "queued"`) **once**, at the moment the campaign
moves from `draft`/`ready` into `scheduled` or `sending` —
`audienceSnapshotAt` records when. It is never re-queried live at send
time. Two reasons: (1) a `filter`-sourced audience for a campaign
scheduled 3 days out must not silently grow or shrink as leads change
status in the meantime — what an operator reviewed when they scheduled
it is what sends; (2) re-running a filter query per-message at send time
against a live collection is real, avoidable load at scale, and `Message`
rows need to exist anyway for delivery tracking regardless of audience
source. This mirrors the same reasoning `WHATSAPP_ARCHITECTURE.md`
already gave for keeping `Message` persistence at the center of this
design.

**Contact Segmentation** ("saved, reusable audience definitions") is
covered by simply letting a `filter`-sourced `WhatsAppCampaign` store
its filter criteria — a marketer re-creating a campaign with "the same
audience as last time" copies the stored filter, no separate "Segment"
entity needed unless a future requirement asks for one independent of
any specific campaign.

---

## 6. CSV import workflow

1. `POST` with `multipart/form-data` (the one new HTTP concern this
   whole design introduces — every other route in this codebase is
   JSON; file upload needs Next.js's `request.formData()` instead of
   `parseJsonBody()`).
2. Parse rows expecting at minimum a phone-number column (flexible
   header matching — `phone`/`Phone`/`WhatsApp Number`/etc., same
   spirit as the existing `normalizeIndianMobile` phone-normalization
   already used for the ai-bootcamp registration flow); optional
   `name` column.
3. **Validate every row** before persisting anything — invalid/
   unparseable phone numbers are collected into a rejected-rows report
   returned to the caller, not silently dropped or silently sent to
   garbage numbers.
4. **Deduplicate** within the same import (the same number listed
   twice) and, separately, flag numbers matching an existing Lead so
   the resulting `Message.leadId` back-reference is populated where
   possible.
5. Store as `Message` rows (`status: "queued"`, `campaignId` set) —
   same terminal representation as a `filter`- or `manual`-sourced
   audience, per §5's resolution rule. No separate "uploaded contacts"
   table.

**Library choice:** no CSV-parsing dependency exists in this codebase
today. A small, well-established one (e.g. `csv-parse`, or Papa Parse)
would need to be added — the one new runtime dependency this whole
design requires. Flagged explicitly since Module 10 (Performance
Optimization) made a point of *removing* unused dependencies; adding
one back needs to be a deliberate, justified choice, not an oversight —
this is that justification.

---

## 7. Bulk messaging workflow & queue architecture

Reuses the Automation Engine's proven shape, not a new mechanism:

- `Message` rows with `status: "queued"` are this system's job queue —
  the same role `WorkflowRun` rows with a due `nextRunAt` play for the
  Automation Engine.
- A poller, `processQueuedCampaignMessages()`, shaped exactly like
  `runDueWorkflowSteps()`: find queued messages ready to send, process
  each via **the existing `processSendJob()`** (no parallel sending
  path — this is the literal "integrates seamlessly with the existing
  WhatsApp Cloud API module" requirement), update status based on the
  result.
- **Pacing, not just "send them all":** Meta (and every vendor) enforces
  messaging rate limits and per-number throughput tiers. The poller
  processes a bounded batch per invocation (analogous to
  `MAX_CAMPAIGNS_FOR_OVERALL_METRICS`'s existing precedent of capping
  work-per-call in the Marketing Dashboard module) rather than draining
  an entire 10,000-row campaign in one invocation — both to respect
  vendor rate limits and to keep each poller invocation's duration
  bounded and predictable.
- **Scheduling** (§4's `scheduled` → `sending` transition) is a
  *separate*, smaller poller — `promoteScheduledCampaigns()` — checking
  `WhatsAppCampaign.scheduledFor`, exactly analogous to
  `WorkflowRunRepository.findDue()`. It only flips campaign status and
  creates the `Message` rows (§5's snapshot) — it does not itself send
  anything; the bulk-send poller above picks up the newly-queued
  messages on its own next run.
- **Neither poller is wired to a live scheduler**, for the same reason
  `runDueWorkflowSteps()` isn't today: no cron/scheduler infrastructure
  exists anywhere in this app yet. This is the same open question
  `WHATSAPP_ARCHITECTURE.md` already raised (§5, open question 3) — one
  scheduling decision serves both the pre-existing Automation Engine gap
  and this new one, not two separate decisions.

---

## 8. Retry strategy

Two distinct layers, deliberately not merged — same principle
`WHATSAPP_ARCHITECTURE.md` already documented for the existing
immediate-vs-persisted retry split:

- **Immediate, in-process** (unchanged, already exists): the Meta
  adapter's `withRetry()` — a single `Message`'s send attempt still gets
  its existing 3-attempt exponential backoff for transient HTTP-level
  failures, within one poller tick.
- **Campaign-level "Retry Failed"** (new): an explicit operator action
  (or an automatic one, see below) that finds a campaign's `Message`
  rows with `status: "failed"`, resets them to `status: "queued"`
  (incrementing `attempts`, capped at a max so a permanently-invalid
  number doesn't retry forever), and lets the bulk-send poller pick them
  up on its next run. This is what "Retry Failed" as its own named
  requirement means at campaign scale: re-attempting a *subset*
  (the failures) without re-sending to everyone who already succeeded.
- **Classification matters for both layers:** `Message.failureReason`
  should distinguish retryable failures (rate-limited, transient vendor
  error — reuses `WhatsAppError.retryable`, already computed by the
  Meta adapter today) from permanent ones (invalid number, unapproved
  template) — retrying the latter automatically would be pointless
  churn against the vendor's API and against `attempts`' cap.

---

## 9. Analytics flow

Delivery/Read/Failed Analytics are all the same underlying query
against `Message`, grouped by `status`, scoped by `campaignId` — one
aggregation, three named views of it (matching the compound
`{campaignId, status}` index in §3).

**Denormalized rollup counts on `WhatsAppCampaign` itself**
(`sentCount`/`deliveredCount`/`readCount`/`failedCount`), updated
incrementally whenever a `Message`'s status changes (in the webhook
handler, and in the bulk-send poller), rather than always computed
live by aggregating `Message` on every Campaign History page view. This
mirrors the existing precedent: `Campaign.registrationCount` (the
*existing*, unrelated Campaign entity) is exactly this same
denormalized-counter pattern, already proven in this codebase, already
updated transactionally alongside the row that changes it
(`registrationService.createRegistration()`'s existing
`runInTransaction()` + `incrementRegistrationCount()` pattern is the
direct precedent to follow here). A live aggregation query remains
available for a single campaign's detail view (exact, not denormalized)
— the denormalized counters are for Campaign History's list view, where
aggregating per-row for every campaign in a paginated list would be
real, avoidable cost.

---

## 10. Error handling

Layered, reusing what exists rather than inventing a parallel hierarchy:

- **Per-send**: unchanged — `WhatsAppError`/`WhatsAppSendResult`, as
  already returned by every provider.
- **Per-message-row**: `Message.status: "failed"` +
  `failureReason` — the persisted record of a `WhatsAppError` that
  couldn't be resolved after retries.
- **Per-campaign**: a campaign does not fail outright because some
  recipients failed (§4 — `completed` with `failedCount > 0` is a valid
  terminal state). A campaign only reaches `status: "failed"` for a
  campaign-level problem — e.g. its referenced `CampaignTemplate` or
  provider becomes invalid/unconfigured mid-flight, not an individual
  recipient's bad number.
- **CSV import validation errors** (§6) are returned to the caller as a
  structured rejected-rows report — the same `ApiFieldError[]` shape
  every other validation failure in this codebase already uses, applied
  per-row instead of per-field.
- **API-layer**: every new route wrapped in the existing
  `withApiRoute()` (`lib/api/withApiRoute.ts`) — uniform error
  responses, `requiredRole: "admin"` (matching every existing admin
  route's scoping decision — see the Authentication module's own
  reasoning for why this wasn't relaxed to Manager/Counsellor without a
  product decision), rate limiting.

---

## 11. Logging strategy

Structured, via the existing shared `lib/logger.ts` primitive — no new
logging mechanism. Event names follow the established
`<domain>.<event>` convention already used throughout (`whatsapp.*`,
`automation.*`, `security_audit.*`): `campaign.created`,
`campaign.scheduled`, `campaign.send_started`, `campaign.completed`,
`campaign.message_queued`, `campaign.message_sent`,
`campaign.message_failed`, `campaign.retry_requested`.

**One business-audit-worthy event, not just an operational log**:
campaign creation and "Retry Failed" being invoked are genuine business
actions (someone decided to message a few hundred/thousand people) —
these belong in `auditLogService` (category: "business"), the same
threshold already applied to `LEAD_CREATED`/`CAMPAIGN_CREATED`/
`REGISTRATION_CREATED`/`USER_CREATED`. Individual message send/deliver/
read/fail events are high-frequency and routine — those stay operational
logs only, the same judgment already applied to "a routine successful
token refresh isn't audit-worthy" in the Authentication module.

---

## 12. Scalability considerations

- **Bounded poller batches** (§7) — the same reasoning as the Marketing
  Dashboard's capped per-call campaign iteration; a poller invocation's
  duration must stay predictable regardless of total campaign size.
- **Pagination everywhere a list is shown** — Campaign History and a
  campaign's Message list both reuse `lib/pagination.ts`, exactly like
  every existing Admin Dashboard Backend list.
- **Denormalized counters, not live aggregation, for list views** (§9)
  — the one deliberate scalability-motivated redundancy in this design,
  justified by existing precedent.
- **CSV import size**: needs a hard cap (a specific number is a product
  decision, not an architectural one — flagged as an open question
  below) to avoid one upload creating an unbounded number of `Message`
  rows in a single request.
- **Vendor rate limits** are the actual bottleneck at real scale, not
  this app's own database or compute — the bounded-batch poller (§7) is
  the mechanism for respecting them; the exact batch size and inter-batch
  delay should be tuned against whatever real vendor tier is configured
  (Meta's own throughput tiers vary by phone number quality rating),
  not hardcoded once and forgotten.

---

## 13. Service & repository layers (named, not built)

- `lib/services/campaignManager/` — new module, mirroring every
  existing service module's shape (`types.ts`, `validation.ts`, a
  service file, `index.ts`):
  - `campaignService` (name collision with the *existing*
    `lib/services/campaigns`'s `campaignService` — will need a distinct
    export name, e.g. `whatsappCampaignService`, decided at
    implementation time, not guessed here).
  - `csvImportService` — parsing/validation, kept separate from the
    campaign service itself (single responsibility — CSV parsing has
    nothing to do with campaign lifecycle logic).
  - `campaignQueueService` (or the two poller functions living directly
    in the service module, matching how `runDueWorkflowSteps()` lives in
    `lib/services/automation/engine.ts` rather than a separate file).
- `lib/db/models/{whatsappCampaign,campaignTemplate,message}.model.ts` +
  matching `*.mongodb.repository.ts`/`*.inMemory.repository.ts` pairs,
  registered in `lib/db/registry.ts` alongside every existing entity.
- Routes under `app/api/admin/whatsapp-campaigns/*` (naming avoids
  colliding with the existing `/api/admin/campaigns`), all
  `requiredRole: "admin"`, all built on `withApiRoute`.

---

## 14. Integration points with existing modules (explicit, since you asked for seamless integration)

- **WhatsApp Cloud API module**: the bulk-send poller's only interface
  to actually sending is the existing `processSendJob()` — zero new
  sending logic, zero new provider code, zero changes to
  `whatsappService`, `registry.ts`, or any adapter.
- **Webhook handler**: gains exactly one new responsibility — look up a
  `Message` row by `providerMessageId` and update its status/
  timestamp/campaign rollup counters, instead of only logging the event
  (per `WHATSAPP_ARCHITECTURE.md` §2's persistence gap). The signature
  verification, challenge handshake, and event parsing are untouched.
- **Automation Engine (future)**: this design doesn't require any
  Automation Engine change to work, but is shaped so a future workflow
  step *could* call `whatsappCampaignService.sendNow(campaignId)` or
  react to a `campaign.completed` event the same way `triggers.ts`
  already reacts to `registration.created` — no architectural change
  needed later to support that, just a new call site.
- **CRM Dashboard UI (Module 11)**: explicitly out of scope per your
  instructions — only reusable, backend-ready APIs and services are
  being designed. A future dashboard page would consume these the same
  way the existing Leads/Campaigns/Registrations pages consume the
  Admin Dashboard Backend.

---

## 15. Open questions before implementation

1. **CSV parsing library** (§6) — a new dependency is required either
   way; do you have a preference, or should I choose the smallest
   well-maintained option?
2. **CSV import size cap** (§12) — what's a reasonable per-upload
   recipient limit for this deployment?
3. **Scheduler mechanism** — same open question already raised in
   `WHATSAPP_ARCHITECTURE.md`, now shared by three unwired pollers
   (`runDueWorkflowSteps`, `promoteScheduledCampaigns`,
   `processQueuedCampaignMessages`). One decision, three beneficiaries.
4. **Max retry attempts** for campaign-level "Retry Failed" (§8) —
   a specific cap is a product/cost decision (each retry is a real
   vendor API call), not something to pick arbitrarily.
5. **Export name collision** (§13) — confirming `whatsappCampaignService`
   (vs. some other name) as the export that avoids colliding with the
   existing `campaignService` from `lib/services/campaigns`.

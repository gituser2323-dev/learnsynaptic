# WhatsApp API Documentation

Companion to `WHATSAPP_ARCHITECTURE.md` — this documents every actual
HTTP endpoint, service method, and provider contract that exists today.
**There is currently no public HTTP endpoint for *sending* a WhatsApp
message** — sending happens server-side, called directly from other
server code (today: the Automation Engine). The only HTTP surface is
the inbound webhook. This is stated plainly rather than documenting an
endpoint that doesn't exist.

---

## HTTP Endpoints

### `GET /api/webhooks/whatsapp`

The one-time webhook-setup verification handshake, called by Meta when
you register the webhook URL in the Meta App Dashboard — not something
your own code calls.

**Query parameters** (Meta's `hub.*` convention):

| Param | Type | Description |
|---|---|---|
| `hub.mode` | string | Must be `"subscribe"` |
| `hub.verify_token` | string | Must match `WHATSAPP_META_WEBHOOK_VERIFY_TOKEN` |
| `hub.challenge` | string | Echoed back verbatim on success |

**Responses:**

| Status | Body | When |
|---|---|---|
| `200` | The raw `hub.challenge` string (plain text, **not JSON**) | `hub.mode` and `hub.verify_token` both check out |
| `403` | `"Forbidden"` (plain text) | Either doesn't match |

Rate limit: 20 requests / 60s (route name: `whatsapp.webhook.verify`).

---

### `POST /api/webhooks/whatsapp`

Inbound delivery/read/failed status updates from Meta, sent after your
own outbound sends. Verifies `X-Hub-Signature-256` (HMAC-SHA256 over
the exact raw body, using the app secret) before trusting anything in
the payload.

**Headers:**

| Header | Required | Description |
|---|---|---|
| `X-Hub-Signature-256` | Yes | `sha256=<hex-hmac>` of the raw body |

**Body:** Meta's standard webhook envelope
(`entry[].changes[].value.statuses[]`), each status carrying an `id`
(the provider message id), `status` (`sent`/`delivered`/`read`/`failed`),
`timestamp` (unix seconds), `recipient_id`, and optionally `errors[]`.

**Responses:**

| Status | Body | When |
|---|---|---|
| `200` | `{ "received": true, "count": <n> }` | Signature valid; `n` events parsed and logged |
| `401` | `{ "received": false }` | Signature missing, malformed, or doesn't match |

**Current behavior — read this before assuming more than it does:**
every valid event is logged (`whatsapp.status_event`, structured, via
`lib/logger.ts`) and then **discarded** — nothing is written to a
database. See `WHATSAPP_ARCHITECTURE.md` §2 ("Delivery Status / Read
Status") for why, and what adding persistence here would look like.

Rate limit: 300 requests / 60s (route name: `whatsapp.webhook.receive`)
— deliberately higher than the public lead/campaign/registration
routes, since Meta can legitimately deliver many status events in quick
succession after a burst of outbound sends.

---

## Service Layer (internal — not HTTP)

`import { whatsappService } from "@/lib/services/whatsapp"`. Every
method returns a `WhatsAppSendResult`, which **never throws** on a
normal send failure (bad number, vendor outage) — callers check
`result.success`. It can still throw synchronously for a genuine
configuration error (a provider that isn't integrated at all —
`WhatsAppProviderNotImplementedError` — see Error Handling below).

### `sendRegistrationConfirmation(recipient, data)`
```ts
recipient: { phoneE164: string; name?: string }
data: { programName: string; cohortDate: string }
```
Sends the `registration_confirmation` template. Intended to be called
immediately after a signup — **not currently wired to
`registrationService.createRegistration()`**; no call site exists yet
(see WHATSAPP_ARCHITECTURE.md §3 on the stale comment this correction is
based on).

### `sendCohortReminder(recipient, data)`
```ts
recipient: { phoneE164: string; name?: string }
data: { sessionTitle: string; startsAt: string }
```
Sends the `cohort_reminder` template. Not currently called from
anywhere.

### `sendTemplateMessage(recipient, templateName, languageCode, variables)`
The generic escape hatch for an arbitrary pre-approved template — used
today by `lib/services/automation/workflows/leadNurtureSequence.ts`'s
three steps (`lead_welcome_v1`, `lead_reminder_v1`,
`lead_special_offer_v1` — illustrative template names; creating and
getting these approved in Meta Business Manager is a real deployment
prerequisite, not done here).

### `sendPlainText(recipient, body)`
Free-form text. **Only deliverable inside a vendor's 24-hour
customer-service window** (i.e. after the recipient has messaged your
number first) — every vendor's own API enforces this, not just this
codebase's convention. Sending this as first contact will fail at the
vendor.

### `verifyWebhookChallenge(challenge)` / `parseWebhookEvent(rawBody, signatureHeader)`
Thin pass-throughs to the active provider — what
`app/api/webhooks/whatsapp/route.ts` calls. Documented under the HTTP
endpoints above since that's where they're actually exercised.

---

## Provider Contract (`WhatsAppProvider`)

Every vendor adapter (`lib/services/whatsapp/providers/*.provider.ts`)
implements this. Relevant if you're integrating one of the four
currently-scaffolded vendors (AiSensy, Interakt, WATI, Gallabox) or a
new one.

```ts
interface WhatsAppProvider {
  readonly id: WhatsAppProviderId;
  sendText(recipient: WhatsAppRecipient, body: string): Promise<WhatsAppSendResult>;
  sendTemplate(recipient: WhatsAppRecipient, payload: WhatsAppTemplatePayload): Promise<WhatsAppSendResult>;
  verifyWebhookChallenge(challenge: WhatsAppWebhookChallenge): string | null;
  parseWebhookEvent(rawBody: string, signatureHeader: string | null): WhatsAppWebhookEvent[] | null;
}
```

- `sendText`/`sendTemplate` return `WhatsAppSendResult`:
  `{ success: true, provider, providerMessageId }` or
  `{ success: false, provider, error: WhatsAppError }`, where
  `WhatsAppError` carries `{ code, message, retryable, raw? }`.
- `verifyWebhookChallenge` returns the challenge string to echo back, or
  `null` to reject (caller responds `403`).
- `parseWebhookEvent` returns normalized `WhatsAppWebhookEvent[]`, or
  `null` if the signature is invalid/payload doesn't parse — `null`
  means "reject the whole webhook," not "zero events."

**Registered providers today** (`lib/services/whatsapp/registry.ts`),
selected by the `WHATSAPP_PROVIDER` env var:

| id | Status |
|---|---|
| `console` | Working dev default — logs, no network call, no credentials needed |
| `meta-cloud-api` | Real, production-capable (needs Meta credentials) |
| `aisensy` | Scaffolded — throws `WhatsAppProviderNotImplementedError` if called |
| `interakt` | Scaffolded — same |
| `wati` | Scaffolded — same |
| `gallabox` | Scaffolded — same |

---

## Configuration Reference (`config/whatsapp.ts` / `.env.local`)

All server-only (never `NEXT_PUBLIC_*`).

| Variable | Used by |
|---|---|
| `WHATSAPP_PROVIDER` | Selects the active provider; unset/invalid → `"console"` |
| `WHATSAPP_META_PHONE_NUMBER_ID` | Meta adapter — the sending phone number's id |
| `WHATSAPP_META_ACCESS_TOKEN` | Meta adapter — outbound API auth |
| `WHATSAPP_META_API_VERSION` | Meta adapter — Graph API version, defaults to `v21.0` |
| `WHATSAPP_META_WEBHOOK_VERIFY_TOKEN` | Meta adapter — GET handshake |
| `WHATSAPP_META_APP_SECRET` | Meta adapter — POST HMAC verification (distinct from the access token) |
| `WHATSAPP_AISENSY_API_KEY` | Reserved for the AiSensy adapter, once integrated |
| `WHATSAPP_INTERAKT_API_KEY` | Reserved for the Interakt adapter |
| `WHATSAPP_WATI_API_ENDPOINT`, `WHATSAPP_WATI_ACCESS_TOKEN` | Reserved for the WATI adapter |
| `WHATSAPP_GALLABOX_API_KEY`, `WHATSAPP_GALLABOX_API_SECRET`, `WHATSAPP_GALLABOX_CHANNEL_ID` | Reserved for the Gallabox adapter |

---

## Not documented above because it doesn't exist yet

Per `WHATSAPP_ARCHITECTURE.md`'s gap analysis: there is no
`POST /api/whatsapp/send` (or any bulk-send endpoint), no
`GET /api/admin/whatsapp/messages` (message history), and no
`WhatsAppCampaign` endpoints. These would be the natural additions once
the Message/Campaign repository layer proposed in the architecture doc
is approved and built.

# Configuration & Integration Verification — Launch Checklist

Companion to `RC_10_AUDIT.md` (the V1.0 launch-gate verdict) and
`CHANGELOG.md`'s own entry for this phase. RC-10 asked "is the product
safe to onboard a customer." This phase asks a narrower, more literal
question: **can a non-technical business owner actually configure every
integration LearnSynaptic offers, and does the app tell the truth about
whether each one is working — before Customer #1 shows up?**

Scope was explicitly configuration verification, not new product
features. One real gap was found and closed: most integration
categories (AI, Storage, Payments, Email, WhatsApp) had **no way to
verify a credential actually works** — only Calendar ("Sync now") and
Notification webhooks ("Test Notification") had a real test action.
Everything else silently assumed "if it's saved, it must be right."
That gap is now closed for every category — see §2.

---

## 1 · What already existed (verified, not rebuilt)

- **Integrations Registry** (`lib/services/integrations`) — the single
  source of truth for all 20 providers, with real encrypted per-tenant
  credential storage (AES-256-GCM), status/health/last-sync tracking,
  and secret masking already correct by construction (a summary object
  never carries plaintext).
- **Settings → Integrations page** — already renders Connected/
  Disconnected, Enabled/Disabled, Health, Last Success/Last Failure,
  Last Error, and a Logs panel for every provider. This was more
  complete than the earlier UX Audit gave it credit for; it simply had
  no data to show for providers nobody had ever tested.
- **Calendar "Sync now"** (`calendarService.syncNow`) — a real,
  working connection test predating this phase. Untouched.
- **Notification webhooks "Test Notification"** — a real, working
  connection test predating this phase, scoped to Slack/Teams/Discord.
  Untouched.
- **Startup preflight** (`lib/services/systemHealth/preflightService.ts`,
  RC-4) — already checks Database, Authentication, Encryption, Queue,
  Cron, Workers, Storage, and Observability, plus per-integration
  deployment-wide credential presence (WhatsApp, Email, AI, three
  payment gateways, three calendar OAuth apps). Surfaced live via
  `GET /api/admin/system/preflight`, `scripts/preflightCheck.ts`, and
  the Platform Console dashboard's "Platform Health" panel. This *is*
  the Startup Health Check the mission asked for — it was already
  built, just under-surfaced (see §3).
- **`.env.example`** (463 lines) — already a complete, categorized
  (REQUIRED / RECOMMENDED / PLATFORM / TENANT-AWARE / PUBLIC /
  OPTIONAL) reference for every environment variable this deployment
  reads. This *is* the environment-variable classification the mission
  asked for; nothing new needed writing, it needed cross-checking
  against runtime reality, which §2's Test Connection buttons now do
  live, per-provider, instead of as a static document.

## 2 · What was built: a real Test Connection for every remaining category

New: `lib/services/integrations/connectionTest.ts`,
`POST /api/admin/integrations/[providerId]/test-connection`, and a
"Test Connection" button + result line wired into every applicable
provider card in Settings → Integrations. Every branch makes a real,
read-only vendor call — never assumes success from an env var being
merely present:

| Category | Real check performed |
|---|---|
| AI — OpenAI / Anthropic / Gemini | A real 5-token completion call through the actual adapter (`AiProvider.complete`), bypassing usage metering (a credential check, not a billed feature use). |
| Storage — AWS S3 | `HeadBucketCommand` — S3's own "does this bucket exist and am I authorized" call. Chosen over the existing `exists()` method, which swallows auth errors into a plain `false`. |
| Storage — Cloudinary | Cloudinary's own account Usage API (Basic-auth) — a 401 here means bad credentials, never "not found." |
| Email — Postmark | Postmark's own `GET /server` — verifies the server token without sending any email. |
| WhatsApp — Meta Cloud API | A real Graph API lookup of the configured phone-number resource — confirms the access token AND phone number ID are valid and belong together. |
| Payments — Razorpay / Stripe / Cashfree | `getPaymentStatus()` against a synthetic order id — a real vendor round trip; the response is classified as a genuine credential failure vs. "credentials fine, order not found" by matching the vendor's own error text (disclosed best-effort, since none of these providers' shared error type carries the HTTP status code). |
| Payments — PhonePe / PayPal | Disclosed as not-yet-implemented scaffolds — same honest answer `connect()` already gave, never a fabricated pass. |
| Calendar (all 5) | Unchanged — already real via "Sync now." |
| Notifications (Slack/Teams/Discord) | Unchanged — already real via "Test Notification." |

Every result — pass or fail — is written to that provider's own
Integration Log (`recordSync`), including built-in providers
(OpenAI/Anthropic/Gemini/Email/WhatsApp), which previously had **no**
sync-logging path at all (`recordSync` unconditionally no-opped for
`builtIn` providers; it now always logs, and only skips the
connection-row health update those providers don't have). Live-verified
in a running dev instance: every category above was exercised for real
against this deployment's actual (unconfigured) environment and
returned a correct, honest failure message — see §4.

## 3 · Startup Health Check — closed one real surfacing gap

`preflightService.ts`'s `tenantIntegrations` array (WhatsApp, Email,
AI, 3 payment gateways, 3 calendar OAuth apps) was computed on every
Platform Dashboard load but never rendered — the dashboard only showed
the platform-blocking `categories` half of the report. Added a
"Configuration & Integration Verification" panel to
`app/admin/platform/page.tsx` rendering the full `tenantIntegrations`
list. Also added a "Webhooks (Outbound Delivery)" entry to that same
list (`WEBHOOK_SECRET_ENCRYPTION_SECRET` presence) — the one category
literally named in this phase's mission that had no dedicated line
anywhere. "Redis" and "Workers" are deliberately reported as **not
applicable** (unchanged, pre-existing `checkWorkers()` wording) — this
deployment's real queue is the MongoDB-backed scheduler drained by
Vercel Cron, a disclosed RC-3 architecture decision, not a gap.

## 4 · Real configuration test pass — results against THIS deployment

This dev/staging environment has Database, Authentication, and
Encryption secrets configured (as `.env.local` requires for the app to
run at all) but **zero real third-party vendor credentials** — by
design, matching every prior RC's test environment. Every Test
Connection button was exercised for real against that state:

| Provider | Real result returned |
|---|---|
| OpenAI / Anthropic / Gemini | `No API key configured for {id}.` |
| AWS S3 | `AWS_S3_BUCKET/AWS_S3_REGION/AWS_S3_ACCESS_KEY_ID/AWS_S3_SECRET_ACCESS_KEY must all be set.` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET must all be set.` |
| Razorpay | `Payment provider "razorpay" is not configured: missing env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.` |
| Stripe | `Payment provider "stripe" is not configured: missing env var: STRIPE_SECRET_KEY.` |
| Cashfree | `Payment provider "cashfree" is not configured: missing env vars: CASHFREE_APP_ID, CASHFREE_SECRET_KEY.` |
| WhatsApp | `No automated connection test is implemented for the "console" WhatsApp provider yet — only Meta Cloud API supports it.` (this deployment's `WHATSAPP_PROVIDER` is unset/`console` — correct, honest behavior) |

Every one of these is the **correct** answer for an unconfigured
deployment — no false positives, nothing fabricated. The
`test-connection` route's rate limit (10 requests/minute per the same
convention `notification-test` already uses) was also live-confirmed:
a rapid back-to-back sweep across providers correctly received `429
Too many requests` after the 10th call in the window.

This proves the **mechanism** end-to-end (Configure → Save → Test →
real, truthful result surfaces in the UI and in Logs). It does not, and
cannot, prove any real vendor's credentials work — that requires a real
vendor account, which is Customer #1's own onboarding step, not
something this codebase can simulate honestly.

## 5 · What the Platform Owner needs to do before Customer #1

Every row below is a real env var from `.env.example`; "where" is the
literal file. None of this is optional busywork — each is the
documented prerequisite for the feature next to it to do anything.

### Must configure before ANY real customer (platform-wide, one-time)

| # | What | Env var(s) | How to verify it worked |
|---|---|---|---|
| 1 | Production database | `MONGODB_URI` | Platform Console → Dashboard → Platform Health → "Database: ok" |
| 2 | Auth secrets (unique to this deployment, never reused from local dev) | `JWT_ACCESS_TOKEN_SECRET`, `AUTH_OAUTH_STATE_SECRET` | Platform Health → "Authentication: ok" |
| 3 | Encryption-at-rest secrets (4 separate keys) | `MFA_ENCRYPTION_SECRET`, `TENANT_CREDENTIAL_ENCRYPTION_SECRET`, `WEBHOOK_SECRET_ENCRYPTION_SECRET`, `CALENDAR_TOKEN_ENCRYPTION_SECRET` | Platform Health → "Encryption: ok" |
| 4 | Cron (nothing async fires without this) | `CRON_SECRET` (must match `vercel.json`'s deploy config) | Platform Health → "Cron: ok" and "Queue: ok" |
| 5 | Durable file storage (default `local` does not survive a serverless deploy) | `STORAGE_PROVIDER=aws_s3` (or `cloudinary`) + that vendor's keys below | Settings → Integrations → AWS S3 → Connect → **Test Connection** |

### Configure per real feature you intend to offer (each is independently optional)

| # | Feature | Where a business owner configures it | How to verify |
|---|---|---|---|
| 6 | Real WhatsApp sending | `WHATSAPP_PROVIDER=meta-cloud-api` + `WHATSAPP_META_*` (platform default), **or** an org self-connects via Settings → Integrations → WhatsApp → Embedded Signup (needs `WHATSAPP_META_APP_ID`/`_EMBEDDED_SIGNUP_CONFIG_ID` set first) | Settings → Integrations → WhatsApp → **Test Connection** |
| 7 | Real email sending (Postmark) | `EMAIL_PROVIDER=postmark` + `EMAIL_POSTMARK_SERVER_TOKEN`/`_FROM_ADDRESS` | Settings → Integrations → Email → **Test Connection** |
| 8 | AI features (Lead Insights, Reply Assistant, Conversational Analytics) | `AI_PROVIDER=openai\|anthropic\|gemini` + that vendor's `*_API_KEY` | Settings → Integrations → (OpenAI/Anthropic/Gemini) → **Test Connection** |
| 9 | Payment collection | `RAZORPAY_KEY_ID`/`_SECRET` and/or `STRIPE_SECRET_KEY` and/or `CASHFREE_APP_ID`/`_SECRET_KEY` | Settings → Integrations → (provider) → Connect → **Test Connection** |
| 10 | Calendar scheduling / video links | `GOOGLE_OAUTH_*`, `MICROSOFT_OAUTH_*`, and/or `ZOOM_OAUTH_*` (each is its own OAuth app, separate from Social Login's `AUTH_GOOGLE_*`/`AUTH_MICROSOFT_*`) | Settings → Integrations → (provider) → Connect (redirects to real consent screen) → **Sync now** |
| 11 | Team Slack/Teams/Discord alerts | Paste that channel's own Incoming Webhook URL directly in Settings → Integrations — no env var | Settings → Integrations → (provider) → **Test Notification** |
| 12 | Outbound webhooks to a customer's own system | `WEBHOOK_SECRET_ENCRYPTION_SECRET` (platform, one-time — see #3) then an org registers its own endpoint in Settings → Integrations → Webhook Endpoints | Register an endpoint → trigger a real event → check its Deliveries tab |
| 13 | Error tracking forwarded off-server | `ERROR_TRACKING_PROVIDER=webhook` + `ERROR_TRACKING_WEBHOOK_URL` | Platform Health → "Observability: ok" (currently `warning` is expected and safe — errors still land in stdout/stderr either way) |

### Explicitly NOT required to onboard Customer #1

PhonePe, PayPal (disclosed scaffolds — connecting throws a clear "not
yet implemented" error, never accepts a real charge), Social Login
(Google/Microsoft/GitHub — the app works entirely on email+password
without it), Marketing Dashboard ad-spend/analytics providers,
EmailJS. Every one of these degrades to fully inert, never insecure,
when left blank.

## 6 · Final integration table

| Integration | Configured (this env)? | Working (real test)? | Needs API key? | Needs its own Dashboard/App? | Needs DNS/redirect URI? | Needs business verification? | Can the customer configure it themselves? | Ready for Customer #1? |
|---|---|---|---|---|---|---|---|---|
| WhatsApp (Meta Cloud API) | No | Test Connection returns a real, honest "not configured" | Yes (access token) | Yes (Meta App + WABA) | Webhook callback URL | Yes (Meta Business verification for production sending) | Yes — Embedded Signup, once platform sets Meta App config | Yes, once platform + org complete signup |
| Email (Postmark) | No | Test Connection returns a real, honest "not configured" | Yes (server token) | Yes (Postmark account) | Sender domain DKIM/SPF | Sender signature/domain verification | No — platform-level only today | Yes, once platform sets the token |
| OpenAI / Anthropic / Gemini | No | Test Connection returns a real, honest "not configured" | Yes | Yes (vendor console) | No | No | Yes — org can set its own tenant key in Settings | Yes, once either platform or org sets a key |
| AWS S3 | No | Test Connection returns a real, honest "not configured" | Yes (access key pair) | Yes (AWS account + bucket) | Optional (custom CDN domain) | No | No — platform-level only | Yes, once platform sets bucket + keys |
| Cloudinary | No | Test Connection returns a real, honest "not configured" | Yes | Yes (Cloudinary account) | No | No | No — platform-level only | Yes, once platform sets keys |
| Razorpay / Stripe / Cashfree | No | Test Connection returns a real, honest "not configured" | Yes | Yes (vendor merchant account) | Webhook URL | Yes (KYC/merchant onboarding, vendor-side) | No — platform-level only | Yes, once platform sets keys |
| PhonePe / PayPal | N/A (scaffold) | Honest "not implemented" | — | — | — | — | — | **No — real adapter not built; do not advertise to customers yet** |
| Google / Microsoft / Zoom Calendar | No | Sync now returns a real, honest "not connected" (needs OAuth app first) | Yes (OAuth client id/secret) | Yes (vendor developer console) | Yes (exact redirect URI) | No | Yes — each org connects its own account via OAuth once the platform app exists | Yes, once platform registers the OAuth app |
| Slack / Teams / Discord | No | Test Notification returns a real delivery attempt | No (webhook URL only) | Yes (create an Incoming Webhook in that workspace) | No | No | Yes — fully self-service, no platform step needed | Yes, today |
| Generic Webhooks | Depends on `WEBHOOK_SECRET_ENCRYPTION_SECRET` | Real HMAC-signed delivery with retry + history | No | No | Customer's own receiving endpoint | No | Yes — fully self-service | Yes, once platform sets the encryption secret |

## 7 · Regression

- `npx tsc --noEmit` — clean.
- `npx eslint` on every file touched this phase — clean.
- `npx vitest run` — **834/834 passing across 94 files**, including the
  pre-existing `integrationService.unit.test.ts` (16/16) and
  `preflightService.unit.test.ts` (5/5) suites, unmodified and still
  green after this phase's changes to both files.
- Live-verified in a running dev instance (not just unit tests): every
  Test Connection button across AI/Storage/Payments/Email/WhatsApp
  returned its real result in the UI, logged it to that provider's own
  Logs panel (including built-in providers, previously impossible),
  and the route's rate limit correctly engaged under a rapid sweep.

## 8 · Verdict

The mechanism this phase asked for — verify, don't assume — is now
real for every one of the 20 cataloged integrations. Nothing in this
deployment's current (intentionally empty) vendor configuration was
misrepresented as working. **Configuration & Integration Verification
is complete.** Turning any specific integration on for a real customer
is now purely a matter of a platform owner (or, where self-service
applies, the customer themselves) working through §5's checklist —
no further code changes are required to do so.

Then STOP, per this phase's own explicit instruction.

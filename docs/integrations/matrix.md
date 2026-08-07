# Integration Matrix

**Status: current**, updated for RC-8. Builds on RC-4's original
"External API reality matrix" (`CHANGELOG.md`'s own RC-4 entry) and
extends it with everything verified since (Module 6.5's Slack test,
Module 8.5's WhatsApp Embedded Signup). Status terms, exactly as RC-4
defined them:

- **CODE READY** — a real adapter exists (not a stub), never
  independently confirmed against the vendor's live API in this
  environment.
- **CONFIGURED** — has a real credential set in *this* deployment's
  environment right now (this varies by deployment; "this env" below
  means the environment these RC passes were built and verified in,
  not a claim about every production deployment).
- **LIVE VERIFIED** — actually round-tripped against the vendor's real
  API at least once (even if only a rejection path, e.g. a real `401`
  from an intentionally invalid key — that still proves the adapter
  reaches the real endpoint and parses a real response, not a
  guessed shape).
- **REQUIRES EXTERNAL CONFIGURATION** — code-ready and wired, but
  cannot go further without a real vendor account/App/OAuth
  registration this environment doesn't have.

Never inflate a row — a "✅ Code Ready" adapter that has never seen a
real vendor response is not the same claim as "Live Verified," even if
both look identical from the UI.

---

## 1 · Platform-level integrations vs. tenant-level integrations

The mission's own distinction, stated plainly because it's easy to
conflate the two:

- **Platform configuration** — one credential set for the whole
  deployment, set by LearnSynaptic operators via environment variables
  (Storage, Payments gateway keys, Calendar/Social-Login OAuth apps,
  the WhatsApp Embedded Signup Meta App itself). A customer never sees
  or enters these.
- **Tenant configuration** — a customer organization's own connection,
  made through self-service UI (Settings → Integrations), stored
  encrypted per-organization via Module 8.2's credential resolver.

WhatsApp is the clearest example of both existing side by side: the
**Meta App** (Embedded Signup Config ID, App Secret) is platform
configuration, done once by LearnSynaptic; **which WABA/phone number**
an individual customer connects through that App is tenant
configuration, done by that customer, self-service, via `WhatsAppEmbeddedSignupPanel`
— see [`whatsapp.md`](whatsapp.md#1--platform-configuration-vs-tenant-connection).

## 2 · WhatsApp

| Aspect | Status |
|---|---|
| Meta Cloud API adapter | CODE READY |
| Platform-level default credentials (this env) | Not configured (`WHATSAPP_PROVIDER=console` default) |
| Send/receive round-trip | LIVE VERIFIED (partial) — real Graph API rejection path proven (Module 2.3's real invalid-credential test); no real message send ever completed (no live Meta App in this environment) |
| Embedded Signup (tenant self-connect) | CODE READY, REQUIRES EXTERNAL CONFIGURATION — real OAuth/code-exchange flow built and wired; the actual Facebook Login popup handshake has never executed end-to-end (no real `WHATSAPP_META_APP_ID`/`CONFIG_ID` in this environment). See [`WHATSAPP_EMBEDDED_SIGNUP.md`](../../WHATSAPP_EMBEDDED_SIGNUP.md) for the exact setup an operator needs to complete this. |
| Alternate providers (AiSensy, Interakt, WATI, Gallabox) | Scaffold/stub only — registered in the provider registry, not independently verified against any of these vendors |

## 3 · Email

| Aspect | Status |
|---|---|
| Postmark | CODE READY, not live-verified in this environment |
| SendGrid, Resend | Scaffold only — `send()` throws `EmailProviderNotImplementedError` by design |
| Inbound (Postmark Inbound Stream) | CODE READY, shared-token verified; not live-tested against a real Postmark account in this environment |

## 4 · AI (Lead Scoring, Insights, Assisted Replies, Conversational Analytics)

| Aspect | Status |
|---|---|
| Anthropic | **LIVE VERIFIED** — a real `401` from Anthropic's live API with an intentionally invalid key, confirmed independently across three modules (5.1 Lead Scoring, 5.2 Assisted Replies, 5.3 Conversational Analytics) |
| OpenAI, Gemini | CODE READY — real fetch-based adapters, same shape as Anthropic's, never independently live-tested |
| Tenant BYOK | Supported via Module 8.2's tenant credential resolver — an organization's own API key overrides the deployment default for its own requests |
| Fallback behavior | Unconfigured or a real vendor error → a real persisted `"unavailable"`/`"error"` state, never a fabricated result |

See [`ai.md`](ai.md) for the deterministic-vs-AI-scoring distinction.

## 5 · Payments

| Aspect | Status |
|---|---|
| Razorpay | **LIVE VERIFIED** — real rejection confirmed against Razorpay's live API with test keys |
| Stripe, Cashfree | CODE READY, same checkout/webhook/refund code path as Razorpay, not independently live-tested |
| PhonePe, PayPal | Scaffold only — `PaymentProviderNotImplementedError`, named "(future)" in this module's own original mission |
| Recurring/subscription billing | **Not implemented for any provider** — none of the three real gateways have their own Subscriptions/Billing API wired here; see [`docs/architecture/tenant.md`](../architecture/tenant.md#6--subscription-entitlements-usage-module-83) |

## 6 · Calendar & Meetings

| Aspect | Status |
|---|---|
| Google Calendar / Meet, Microsoft Outlook Calendar / Teams Meetings, Zoom | CODE READY, REQUIRES EXTERNAL CONFIGURATION — real OAuth request-building code, correct against each vendor's documented API; no real OAuth app registered in this environment to confirm a live grant/refresh/event-creation round trip |

## 7 · File Storage

| Aspect | Status |
|---|---|
| Local (dev only) | **LIVE VERIFIED** — real upload/download/delete cycle in a real browser. **Not production-safe on Vercel** (read-only filesystem outside `/tmp`, not shared/durable across instances) |
| AWS S3 | CODE READY (official AWS SDK, not hand-rolled) — not live-verified against a real bucket in this environment |
| Cloudinary | CODE READY — disclosed gap: private/authenticated file delivery (`getSignedUrl()`) is not implemented for Cloudinary specifically; use S3 for private files |

## 8 · Generic Webhooks & Team Notifications

| Aspect | Status |
|---|---|
| Slack | **LIVE VERIFIED** — a real, specific `404: no_team` rejection confirmed from Slack's own live API against a fake-but-well-formed webhook URL |
| Microsoft Teams, Discord | CODE READY — same payload-build/sign/send pipeline as Slack, not independently confirmed against a live workspace |

## 9 · Marketing Dashboard (ad spend / web analytics reporting)

| Aspect | Status |
|---|---|
| Meta Ads | CODE READY, not live-verified in this environment |
| Google Analytics (GA4 reporting API) | CODE READY, not live-verified in this environment |

## 10 · Social Login (RC-1)

| Aspect | Status |
|---|---|
| Google, Microsoft | CODE READY — real OAuth adapters; live verification status not independently re-confirmed by a later RC pass (inherits RC-1's own original verification) |
| GitHub | Optional, same adapter shape, not required for a working deployment |

## 11 · What "Configured (this env)" means for a real deployment

Every "❌ Configured (this env)" above is a statement about the
specific environment these RC passes were verified in — **not** a
claim that a real production deployment can't or shouldn't configure
these. See
[`docs/development/environment.md`](../development/environment.md)
for exactly which environment variables each integration needs, and
[`docs/deployment/deployment.md`](../deployment/deployment.md) for the
platform-level setup checklist.

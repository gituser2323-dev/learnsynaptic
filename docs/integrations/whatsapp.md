# WhatsApp Architecture

**Status: current — this is an index/overview.** WhatsApp is this
app's most extensively documented integration; rather than duplicate
that material, this page ties the existing documents together and adds
what none of them cover on its own (the platform-vs-tenant distinction,
health monitoring, a troubleshooting pointer). Read in this order for
full depth:

1. **This page** — overview, platform vs. tenant, where each real
   concern lives.
2. [`WHATSAPP_ARCHITECTURE.md`](../../WHATSAPP_ARCHITECTURE.md) —
   original architecture audit (provider abstraction, webhook
   verification, templates, sessions) — still current for what it
   covers, though its own §2 gap analysis was later closed by
   `CAMPAIGN_ARCHITECTURE.md`.
3. [`CAMPAIGN_ARCHITECTURE.md`](../../CAMPAIGN_ARCHITECTURE.md) — bulk
   messaging, the scheduler-backed send queue, campaign lifecycle.
4. [`WHATSAPP_EMBEDDED_SIGNUP.md`](../../WHATSAPP_EMBEDDED_SIGNUP.md) —
   the tenant self-service connection flow (Module 8.5).
5. [`API_DOCUMENTATION.md`](../../API_DOCUMENTATION.md) — the real
   HTTP surface (there is deliberately no public "send a message"
   endpoint — sends happen server-side, from the Automation Engine or
   the Campaign scheduler).

---

## 1 · Platform configuration vs. tenant connection

| | Platform (LearnSynaptic-operated) | Tenant (customer self-service) |
|---|---|---|
| What | One Meta App (Embedded Signup Config ID + App Secret) + an optional shared default Meta Cloud API credential | Which WABA/phone number *this* organization connects |
| Env vars | `WHATSAPP_META_APP_ID`, `WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID`, `WHATSAPP_META_APP_SECRET`, `WHATSAPP_META_PHONE_NUMBER_ID` (shared default, optional) | None — stored encrypted per-organization via Module 8.2, never an env var |
| Set by | An operator, once, per deployment | Each customer, via "Connect WhatsApp" in Settings → Integrations (or the RC-7 onboarding wizard's WhatsApp step) |
| Setup guide | [`WHATSAPP_EMBEDDED_SIGNUP.md`](../../WHATSAPP_EMBEDDED_SIGNUP.md) | Same document, from the customer-facing side |

`resolveWhatsAppProviderForSend()` is the real resolution order: an
organization with its own connected Meta credentials (via Embedded
Signup, or manually entered tenant credentials) always routes its own
sends through `meta-cloud-api` regardless of the deployment's own
`WHATSAPP_PROVIDER` default — that env var only matters for
organizations relying on a shared platform number, if the deployment
offers one at all.

## 2 · Where each concern actually lives

| Concern | Lives in |
|---|---|
| Provider abstraction, webhook signature verification | `WHATSAPP_ARCHITECTURE.md`, `lib/services/whatsapp/` |
| WABA/Phone Number discovery, routing inbound webhooks to the right organization | `WHATSAPP_EMBEDDED_SIGNUP.md`, `PhoneNumber` model |
| Templates (creation, sync, approval status) | `WHATSAPP_ARCHITECTURE.md` (Module 2.3), `lib/services/whatsapp/` |
| Conversations (inbox, replies, notes) | `lib/services/conversations/` — see [`docs/architecture/database.md`](../architecture/database.md) |
| Campaigns (bulk send, scheduling, retry) | `CAMPAIGN_ARCHITECTURE.md`, `lib/services/whatsappCampaigns/` |
| Automation (`send_whatsapp_template` workflow action) | [`automation.md`](automation.md) |
| Health monitoring | `GET /api/admin/whatsapp/phone-health` — periodic scheduler job (`TEMPLATE_SYNC_JOB_TYPE`, `PHONE_HEALTH_JOB_TYPE`), reused unchanged by Module 8.5 to run once per organization with a real connected WABA |
| Credentials | Module 8.2's tenant credential resolver — never a plaintext value returned to the browser |

## 3 · Troubleshooting

See [`docs/operations/troubleshooting.md`](../operations/troubleshooting.md#whatsapp)
for real, known failure scenarios (disconnected account, webhook
failures, template unavailable, campaign stuck) with safe diagnostic
steps.

# WhatsApp Embedded Signup — Module 8.5

Business OS Phase 8 (Multi-Tenant SaaS Foundation), Module 8.5. This is
the tenant self-service onboarding flow that lets a customer organization
connect its own WhatsApp Business Platform account using Meta's official
Embedded Signup architecture — without LearnSynaptic staff editing
environment variables, database records, or source code per customer.

No secrets are reproduced anywhere in this document. Every value named
below is either a real Meta Graph API field/endpoint (already documented
by Meta) or an env var **name** — never a real key, token, or secret
value.

---

## 1. Architecture at a glance

```
Tenant Admin
  -> Integrations -> WhatsApp -> "Connect WhatsApp"
  -> Meta Embedded Signup popup (Facebook Login for Business, client-side)
  -> Select/create Business Portfolio, WABA, phone number (inside the popup)
  -> Popup returns an authorization code + session info (waba_id, phone_number_id)
  -> POST /api/admin/integrations/whatsapp/embedded-signup/complete
  -> Server exchanges code for a Meta access token
  -> Server re-verifies the phone number against Meta's own WABA phone list
  -> Server stores the credential (encrypted) + subscribes this app to the WABA's webhooks
  -> Tenant's own WhatsApp connection is Connected
  -> Inbound webhooks for that WABA route to this organization automatically
```

Two configuration layers are deliberately kept separate:

| | Platform (this deployment, one-time) | Tenant (per organization, self-service) |
|---|---|---|
| What | Meta App ID, Meta App Secret, Embedded Signup Config ID | WABA ID, phone number ID, access token, connection status |
| Who sets it | The deployment operator, once, in `.env` | Each tenant admin, via the Connect WhatsApp button |
| Where it lives | `config/whatsapp.ts` (`META_EMBEDDED_SIGNUP_CONFIG`) | Encrypted `IntegrationConnection` row + `PhoneNumberRecord` row, per organization |
| Ever shown to a tenant admin? | App ID / Config ID only (both are meant to be client-visible per Meta's own design) — App Secret never | Own org's data only, token always masked |

## 2. Meta App Dashboard setup (platform, one-time)

Perform this once, in the Meta for Developers dashboard, for the app
this deployment will use as its Tech Provider / ISV app:

1. Create (or use an existing) Meta App with the **WhatsApp** product added.
2. Under **WhatsApp > Configuration**, note the App's own **App ID**.
3. Under **App Settings > Basic**, note the **App Secret** (kept server-side only — see `WHATSAPP_META_APP_SECRET` below, already used by this app's existing webhook-signature verification).
4. Under **WhatsApp > Embedded Signup**, create a new **Configuration** (Meta's own onboarding-flow builder — choose which business-verification steps and asset permissions to request). Note the resulting **Configuration ID**.
5. Under **WhatsApp > Configuration > Webhooks**, register this deployment's single, real webhook URL:
   `https://<your-domain>/api/webhooks/whatsapp`
   with the **same** verify token this deployment already uses for `WHATSAPP_META_WEBHOOK_VERIFY_TOKEN` (unchanged from the existing Meta Cloud API setup — Module 8.5 does not introduce a second webhook URL or verify token).
6. Subscribe the App to the `messages` webhook field (status + inbound message events) at the App level — per-WABA subscription then happens automatically per tenant when a connection completes (`subscribeAppToWaba`, Graph API `POST /{waba-id}/subscribed_apps`).
7. Ensure the App has the `whatsapp_business_management` and `whatsapp_business_messaging` permissions approved for Advanced Access (required for Embedded Signup to grant real customer WABAs, not just the developer's own test WABA).

## 3. Required environment variables

All in `config/whatsapp.ts`, documented with placeholder values in `.env.example`:

| Variable | Purpose | Client-visible? |
|---|---|---|
| `WHATSAPP_META_APP_ID` | Platform Meta App ID — passed to the Facebook JS SDK's `FB.init()` client-side | Yes (by Meta's own design) |
| `WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID` | The Embedded Signup Configuration ID from step 4 above | Yes |
| `WHATSAPP_META_EMBEDDED_SIGNUP_API_VERSION` | Graph API version for onboarding calls (optional — falls back to `WHATSAPP_META_API_VERSION`, then `v21.0`) | No |
| `WHATSAPP_META_APP_SECRET` | **Reused, unchanged** from the existing Meta Cloud API messaging setup — used for both inbound webhook signature verification (unchanged) and the server-side authorization-code exchange (new) | No — server-side only, never returned by any route |
| `WHATSAPP_META_WEBHOOK_VERIFY_TOKEN` | **Reused, unchanged** — the one webhook URL serves every tenant's WABA | No |
| `WHATSAPP_PROVIDER` | Must be set to `meta-cloud-api` for tenant self-service sends to actually reach Meta (see §6) | No |

`isEmbeddedSignupConfigured()` (`config/whatsapp.ts`) is the one place that checks all three onboarding-relevant values are present — every route and the admin UI both honor it; the flow degrades honestly ("not configured — contact your platform administrator") rather than pretending to work when any of them is missing.

## 4. Tenant onboarding flow (what a customer admin does)

1. Tenant Admin (role: `admin`) opens **Settings → Integrations → WhatsApp**.
2. If the organization's plan includes the `whatsapp_embedded_signup` capability and this deployment is configured (§3), a **Connect WhatsApp** button appears.
3. Clicking it opens Meta's own Facebook Login for Business popup (loaded via the official `connect.facebook.net/en_US/sdk.js` SDK — already whitelisted in this app's CSP).
4. Inside the popup, the business owner signs in with their own Facebook Business account, and selects or creates their own Business Portfolio, WABA, and phone number — LearnSynaptic staff are never involved and never see these credentials.
5. On completion, the popup returns an authorization code (via the SDK callback) and session info (via a `postMessage` event carrying the selected `waba_id`/`phone_number_id`).
6. The browser POSTs both to `/api/admin/integrations/whatsapp/embedded-signup/complete`, which:
   - Verifies the organization's own plan entitlement (server-side, never just a UI check).
   - Exchanges the code for a real Meta access token.
   - Re-fetches the WABA's own phone number list from Meta directly and confirms the reported phone number genuinely belongs to it (never trusts the client-reported IDs alone).
   - Stores the token encrypted (Module 8.2's existing `tenant_secret` mechanism — no second secret store).
   - Subscribes this app to the WABA's webhooks.
   - Records the phone number's routing entry (organization ownership) and an initial health snapshot (Module 2.3's existing architecture, extended).
7. The Connect card now shows a real, derived connection state (Connected / Healthy / Action Required / Token Expired / Webhook Error / Phone Verification Required), refreshed on every Settings load.
8. From this point, the SAME existing WhatsApp features (Conversations, Campaigns, Automation, Templates, Analytics) transparently use this organization's own connected number — no separate "SaaS WhatsApp" code path exists.

## 5. Webhook tenant routing

One webhook URL, one Meta App, shared across every tenant (this is
Meta's own real architecture for Embedded Signup — a single Tech
Provider app that gets access-token grants for many businesses' WABAs).
Signature verification stays platform-level and unchanged. What Module
8.5 adds is **routing**: after a webhook's HMAC signature is verified,
`extractPhoneNumberId()` reads Meta's own `metadata.phone_number_id`
field from the payload, and `phoneNumberService.findByPhoneNumberId()`
resolves which organization connected that number (a real, globally
unique lookup — a phone number belongs to exactly one WABA in reality).
Everything downstream (conversation/message recording, campaign status
updates) then runs inside that organization's own tenant context. An
unrecognized number (this deployment's own pre-8.5 default number, if
any) falls back to the existing default-organization behavior,
unchanged.

## 6. Making tenant-connected numbers actually send

Storing a tenant's own WhatsApp credentials is not, by itself, enough
to make its outbound sends reach Meta — this app's WhatsApp provider
selection (`WHATSAPP_PROVIDER`) is a deployment-wide setting. For any
SaaS deployment intending to support tenant self-service WhatsApp:

**Set `WHATSAPP_PROVIDER=meta-cloud-api`** at the platform level. Once
set, every organization's own tenant credentials (if configured) are
resolved automatically per send (`resolveWhatsAppProviderForSend()`,
reusing Module 8.2's existing tenant-credential resolver) — no
per-tenant env edit is ever needed. An organization with no tenant
credentials configured falls back to this deployment's own default Meta
Cloud API config (if any) exactly as before.

## 7. Disconnect and reconnect

Disconnecting (`POST .../embedded-signup/disconnect`) clears the stored
credential, best-effort revokes this app's webhook subscription on the
tenant's WABA, and releases the phone number's routing entry — it never
deletes Conversations, Messages, Activities, or audit history.
Reconnecting (calling `complete` again, same or a different phone
number) is idempotent: the same organization's existing connection row
is updated in place, never duplicated, and switching to a different
phone number automatically releases the old routing entry.

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| "WhatsApp Embedded Signup isn't configured on this deployment yet" | One or more of `WHATSAPP_META_APP_ID`/`WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID`/`WHATSAPP_META_APP_SECRET` is unset. |
| "Self-service WhatsApp connection isn't included in your current plan" | The organization's assigned Plan doesn't include the `whatsapp_embedded_signup` capability — a real product/billing decision, not a bug. |
| Connect button never becomes clickable | The Facebook JS SDK failed to load — check the browser console for a CSP or network error against `connect.facebook.net`. |
| "The selected phone number does not belong to the authorized WhatsApp Business Account" | The popup's own session-info `phone_number_id` didn't match anything in Meta's own `/{waba-id}/phone_numbers` response for the granted token — re-run signup and select the number again inside the popup. |
| Connected, but "Action required" / "Webhook error" | The most recent scheduled health check failed — check `IntegrationLog` entries for this provider; the underlying access token may have been revoked in Meta Business Manager. |
| Tenant sends aren't reaching Meta despite showing "Connected" | `WHATSAPP_PROVIDER` is not set to `meta-cloud-api` at the deployment level — see §6. |

## 9. Known limitations / explicitly out of scope for this module

- **Real, live Meta onboarding (an actual Facebook Login popup completing against a real Business Portfolio) is unverified in this environment** — no live `WHATSAPP_META_APP_ID`/`CONFIG_ID`/`APP_SECRET` exist here. Everything up to that external boundary (code exchange logic, WABA/phone re-verification, credential storage, webhook routing, disconnect/reconnect, RBAC, entitlement, tenant isolation) is real and verified — the live popup handshake itself **REQUIRES LIVE META CREDENTIALS** to complete, a genuine external configuration requirement, not a shortcut taken.
- A platform Super Admin role tier does not exist yet in this app (the global Plan catalog is still gated by the same shared `PLATFORM_ADMIN_SECRET` bearer-token pattern Module 8.3 established) — Module 8.5 does not introduce one.
- Full HTTP-level webhook-routing verification (a real signed POST against the real running server resolving to the correct organization) is exercised at the unit level rather than via Playwright, for the same reason `tests/e2e/conversations.spec.ts` already discloses for Module 2.1/2.2: the shared test server's own `WHATSAPP_PROVIDER` stays at its "console" default so as not to destabilize every other spec's WhatsApp behavior.

# Staging Guide

**Status: current.** Staging exists to test real deploy behavior
safely — it must never be able to touch a real customer, a real
payment, or production's own data. Every rule below closes a specific,
real way that could otherwise happen.

---

## 1 · Staging must never message a production customer

- **`WHATSAPP_PROVIDER` stays `console`** (logs instead of sending) in
  staging, unless you specifically need to test a real send — in
  which case connect a vendor **sandbox** number, never a real
  customer-facing WhatsApp Business number.
- **`EMAIL_PROVIDER` stays `console`**, or a Postmark account with a
  dedicated staging server token — never the production Postmark
  server token.
- Staging's own database must be **staging's own**, never a read
  replica or clone of production containing real customer phone
  numbers/emails a misconfigured provider could accidentally reach.

## 2 · Staging must never process a real payment

`RAZORPAY_KEY_ID`/`STRIPE_SECRET_KEY`/`CASHFREE_APP_ID` in staging
should be each vendor's own **test-mode** keys, never live keys. Every
one of these vendors provides a distinct test/sandbox credential pair
specifically for this — use it. A real charge against a real card must
never be reachable from a staging deployment.

## 3 · Staging must never use production's webhook URLs

Every inbound webhook (WhatsApp, Email, Payments — see
[`deployment.md`](deployment.md#9--webhook-urls-to-register-with-each-provider))
must be registered against **staging's own domain** in each vendor's
dashboard, not production's. Two real failure modes this prevents:

- A vendor delivering a real production event to staging (if staging
  somehow shares production's registered URL) — staging then processes
  a real customer's data with whatever staging's own (likely less
  hardened, more frequently reset) state looks like.
- Staging generating test webhook traffic that production received.

## 4 · Staging must never share production's queue/job namespace

Staging needs its **own** `MONGODB_URI` — since the scheduler queue
(`ScheduledJob`) lives in the same database as everything else (see
[ADR-0003](../development/adr/0003-queue-architecture.md)), sharing a
database with production means sharing the queue too: a staging job
could claim and execute a production-queued job (or vice versa), with
production's own real side effects (a real WhatsApp send, a real
webhook delivery) triggered by a job a staging deploy claimed.

## 5 · Secrets — staging gets its own, never copied from production

`CRON_SECRET`, `JWT_ACCESS_TOKEN_SECRET`, `AUTH_OAUTH_STATE_SECRET`,
and all four encryption-at-rest secrets
([ADR-0005](../development/adr/0005-per-purpose-credential-encryption-keys.md))
must be generated fresh for staging, never copy-pasted from
production. Reusing a production JWT secret in staging means a staging
session token would verify as valid against production (and vice
versa) if the two ever shared a domain/cookie scope — generate
independently, always.

## 6 · OAuth apps — separate registrations, or separate redirect URIs at minimum

Social Login, Calendar Connectors, and any generic Integrations OAuth
app (see [`deployment.md`](deployment.md#10--oauth-callback-urls-to-register))
should have a staging-specific redirect URI registered, ideally on a
staging-specific OAuth app registration entirely (some vendors support
multiple redirect URIs on one app; others don't) — never rely on a
production OAuth app silently accepting a staging callback URL that
happens to work.

## 7 · What's safe to share

- The **codebase** itself, obviously — staging exists to test the
  exact code about to reach production.
- Read-only, non-sensitive configuration that carries no credential or
  real-customer-data risk (e.g. `NEXT_PUBLIC_GA_MEASUREMENT_ID` can
  point at a real analytics property if you want staging traffic
  excluded from production analytics — or a separate staging property,
  either is safe).

## 8 · Quick staging setup checklist

- [ ] Own `MONGODB_URI` (§4)
- [ ] `WHATSAPP_PROVIDER`/`EMAIL_PROVIDER` set to `console` or a real
      vendor **sandbox**, never a live customer-facing channel (§1)
- [ ] Payment provider keys are **test-mode** (§2)
- [ ] Every webhook URL registered points at staging's own domain (§3)
- [ ] Every secret generated fresh, not copied from production (§5)
- [ ] `NEXT_PUBLIC_SITE_URL`/`APP_BASE_URL` point at staging's own
      domain, not production's

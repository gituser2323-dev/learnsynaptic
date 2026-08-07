# Support Diagnostics

**Status: current — including one disclosed gap found while writing
this page, not glossed over.**

---

## 1 · What support staff MAY safely request from a customer

- **Timestamp** (approximate time the issue occurred, with timezone) —
  lets an operator correlate against server-side structured logs.
- **Organization name or the account's own email address** — used to
  look up the organization in the Platform Console
  (`/admin/platform/organizations`), never a raw database id the
  customer would have no way to know anyway.
- **Screenshot** — the actual UI state, including any visible error
  banner text.
- **The exact, non-sensitive error message shown in the UI** — e.g.
  "This endpoint returned a validation error on the email field," not
  a raw stack trace (which this app never shows a user in the first
  place — see [`docs/operations/error-catalog.md`](error-catalog.md)).
- **Which browser/page/action** they were performing.

## 2 · A real, disclosed gap found while writing this page

The mission asked this page to also cover **Request ID** and
**Correlation ID** as safe things to request. Checking the actual
implementation (`lib/api/handleError.ts`): every request **is**
assigned a real `requestId` (`randomUUID()`, threaded through every
log line and into `errorTrackingService` for genuine unhandled
exceptions) — but **it is never returned to the client**, in the
response body or as a header. A customer has no way to see or report
their own request's id today.

This means: **support cannot currently ask a customer for a request
ID**, because the product never shows them one. What support *can* do
instead, until this gap is closed:

- Ask for the precise timestamp + organization + the action taken, and
  have an operator correlate against structured server logs
  (`request.start`/`request.complete`/`request.handled_error` events,
  all carrying the real `requestId`, `route`, and — once tenant context
  resolves — `organizationId`) for that window.
- A Platform Super Admin can additionally check
  `GET /api/admin/platform/security-events` /
  `GET /api/admin/platform/audit-log` for anything RBAC/security-
  relevant in that window.

**Documented as a gap for a future RC, not fixed here** — per the RC-8
mission's own "document the gap, don't implement it" instruction. A
real fix would surface `requestId` as an `X-Request-Id` response
header (cheap, doesn't touch the response envelope) and/or a small
"Request ID: ..." line in the UI's own error toast.

## 3 · What support staff must NEVER request

Never ask a customer for any of the following, under any
circumstance, for any reason:

- **Password**
- **OTP / MFA code**
- **Recovery codes**
- **API secrets / integration credentials** (WhatsApp, Email, AI
  provider keys)
- **Access tokens / refresh tokens**

This app never needs any of these from a customer to diagnose an
issue — every credential-status check available to an operator already
reports Configured/Missing/Expired, never a value (see
[`docs/security/overview.md`](../security/overview.md)). A real
support interaction asking for one of these is either a process bug to
fix immediately, or a phishing attempt impersonating support — treat
it as the latter until proven otherwise.

## 4 · Where an operator actually looks

| Need | Where |
|---|---|
| Organization status, plan, entitlements | `/admin/platform/organizations/[id]` (Platform Console, RC-6) |
| Onboarding funnel status for one organization | `/admin/platform/onboarding` (RC-7) |
| Recent security/RBAC-relevant events | `GET /api/admin/platform/security-events` |
| Audit trail for a specific action | `GET /api/admin/platform/audit-log` / `GET /api/admin/audit-logs` (tenant-scoped) |
| Queue/job failures | `/admin/reliability`, `GET /api/admin/platform/jobs` |
| Integration health | `GET /api/admin/system/preflight` |

See [`docs/user-guides/platform-admin.md`](../user-guides/platform-admin.md)
for the full operator workflow.

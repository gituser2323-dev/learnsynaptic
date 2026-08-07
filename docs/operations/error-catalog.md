# Error Catalog

**Status: current.** This codebase does **not** have a proprietary
error-code system (no `"E4021"`-style codes anywhere) — errors are
represented as typed `ApiError` subclasses
(`lib/api/errors.ts`), each mapping to a real HTTP status code and a
field-level message array, matching the uniform response envelope
documented in [`docs/api/security.md`](../api/security.md#1--response-envelope-uniform-across-every-route).
This page documents that real class hierarchy — not an invented
error-code catalog that would exist only for this document's own sake.

---

## 1 · The real error classes

| Class | HTTP status | Meaning |
|---|---|---|
| `ValidationApiError` | 400 | Request body failed a service's own `validateXInput()` check — `errors` carries one entry per invalid field |
| `UnauthorizedApiError` | 401 | Not authenticated at all (no valid session/token), or `requiredCapability` set on a route with no resolvable organization (a route misconfiguration, not a real user path) |
| `UsageLimitExceededApiError` | 402 | A Module 8.3 usage limit was reached (the one error class using HTTP 402 in this app) |
| `ForbiddenApiError` | 403 | Authenticated, but the role/platform-role/organization-suspension/pre-organization-gate check failed — see [`docs/architecture/overview.md`](../architecture/overview.md#2--request-lifecycle-withapiroute) for which specific check produced it |
| `PlanEntitlementRequiredApiError` | 403 | The organization's plan doesn't include the required capability (a commercial gate, not an RBAC one — same status code, different meaning; check the message) |
| `NotFoundApiError` | 404 | Entity doesn't exist **or** exists in a different organization (tenant isolation's own "cross-tenant id behaves like not-found" convention — see [`docs/architecture/tenant.md`](../architecture/tenant.md)) |
| `PayloadTooLargeApiError` | 413 | Request body exceeded the global size ceiling |
| `RateLimitedError` | 429 | Route's own configured rate limit exceeded — response includes a computed `Retry-After` |
| `UpstreamServiceApiError` | 502 | A real external vendor call (WhatsApp/Email/AI/Payments/Calendar) failed or rejected |
| `ServiceUnavailableApiError` | 503 | `MAINTENANCE_READ_ONLY_MODE` is active and this was a non-safe-method, non-`auth.*` request |

Any error not raised as one of the above (an unexpected exception) is
caught by `withApiRoute()`'s own top-level handler and reported as a
generic `500`, logged with a `requestId` for correlation — never a
raw stack trace or internal message returned to the client.

## 2 · Stable error categories worth knowing

- **Validation errors** (400) are always field-attributed —
  `{field: "email", message: "..."}` — except for whole-body failures
  (`{field: "root", message: "..."}`), e.g. a non-JSON-object body.
- **403 vs. 401** — a request with **no** session at all gets 401;
  a request with a **valid** session that simply lacks the right
  role/plan/organization state gets 403. This distinction is
  meaningful for a client's own retry/redirect logic (401 might
  warrant a token refresh attempt; 403 never does).
- **404 as a security boundary** — deliberately used for both "really
  doesn't exist" and "exists in another tenant" so that no response
  ever distinguishes the two for an unauthorized caller (see
  [`docs/architecture/tenant.md`](../architecture/tenant.md#2--tenant-context--the-enforcement-mechanism)).

## 3 · What is NOT in scope here

Client-side UI error states (toast messages, form validation UX) are
not part of this catalog — this page is the HTTP/API-layer contract
only.

/**
 * RC-3 Reliability, Queues & Observability — shared outbound-request
 * timeout budgets. Before this pass, none of this app's ~22 provider
 * adapter files (Meta/WhatsApp, AI, Email, Payments, Calendar, Storage,
 * outbound Webhooks, Social Login) set any timeout on their own
 * `fetch()` calls — a hung upstream (a stalled TLS handshake, a
 * provider outage that accepts the connection but never responds)
 * could hang a request indefinitely. In a serverless deployment
 * (this app's own real one — see schedulerService.ts's own doc
 * comment) that's not just a slow response, it's the ENTIRE function
 * invocation's time budget spent waiting on one call, including one
 * job out of a scheduler batch that should have moved on to the next
 * 19.
 *
 * Deliberately just named constants, not a `fetchWithTimeout()`
 * wrapper function: every call site already builds its own request
 * options object, so adding `signal: AbortSignal.timeout(MS)` to that
 * object is a one-line change per call — no call site needs
 * restructuring, and `AbortSignal.timeout()` is a native Web API
 * (available in both the Node and Edge runtimes this app already
 * targets — see lib/services/auth/tokens.ts's own doc comment on why
 * that portability already matters here), not a new dependency.
 *
 * The mission's own explicit "do NOT apply the same retry/timeout
 * policy everywhere" instruction, applied to timeouts specifically:
 * different provider categories have genuinely different normal
 * response-time distributions (an AI completion is legitimately
 * slower than a webhook HMAC-verified POST), so this is deliberately
 * per-category, not one global constant.
 */
export const AI_PROVIDER_TIMEOUT_MS = 30_000;
export const MESSAGING_PROVIDER_TIMEOUT_MS = 15_000;
export const PAYMENT_PROVIDER_TIMEOUT_MS = 20_000;
export const EMAIL_PROVIDER_TIMEOUT_MS = 15_000;
export const CALENDAR_PROVIDER_TIMEOUT_MS = 15_000;
export const STORAGE_PROVIDER_TIMEOUT_MS = 20_000;
export const OAUTH_PROVIDER_TIMEOUT_MS = 10_000;
/** Outbound webhook deliveries to a THIRD PARTY's own endpoint (Module
 *  6.5) — deliberately the shortest budget: this app has no control
 *  over the receiving server's own speed, and a slow customer endpoint
 *  must never be allowed to hold up this app's own delivery worker for
 *  longer than a "the receiver is unhealthy" signal actually needs. */
export const OUTBOUND_WEBHOOK_TIMEOUT_MS = 10_000;

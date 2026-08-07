# ADR-0004: Deployment target is Vercel serverless — no Docker/Kubernetes

**Status: Accepted, implemented (RC-4).**

## Context

RC-4 needed to establish a real, documented deployment architecture.
The app's own existing structure (`vercel.json`'s cron entry,
`middleware.ts`'s Edge-runtime split, every outbound provider call's
own bounded-timeout design) already assumed a serverless request/
response shape before RC-4 formalized the decision.

## Decision

Deploy to Vercel (serverless functions for `app/api/**`, Edge runtime
for `middleware.ts`, Vercel Cron for the scheduler). No Docker
container, no Kubernetes, no separately-hosted worker process.

## Consequences

- Every route must complete within a bounded execution time — this
  shaped the scheduler's own internal time-budget design (ADR-0003)
  and this app's consistent use of `AbortSignal.timeout()` on ~30
  outbound provider `fetch` calls, so a slow/hanging vendor can never
  hold a serverless invocation open indefinitely.
- No always-running process exists for a background worker — this is
  the direct cause of ADR-0003's queue decision, not an independent
  choice.
- File uploads route through this app's own Next.js function rather
  than a presigned direct-to-storage flow — a disclosed, real
  limitation: Vercel's own platform-level request-body ceiling is
  below this app's configured per-category upload limits (up to 50MB
  for VIDEO/EXPORT categories), so a sufficiently large upload can be
  rejected by the platform itself before this app's own validation
  ever runs. The real fix (presigned browser-to-S3 uploads) is a
  genuine architectural change touching every upload call site, not
  attempted as part of this decision.
- Local filesystem storage (`STORAGE_PROVIDER=local`) is explicitly
  disclosed as dev-only, never production-safe on this deployment
  target — Vercel's filesystem is read-only outside `/tmp`, and `/tmp`
  itself is neither shared across concurrent instances nor durable
  across invocations. `lib/startupValidation.ts` warns loudly if this
  is still `local` when `NODE_ENV=production`.
- No container image to build/scan/version — Vercel's own build
  pipeline (`next build`) is the deployment artifact. Simpler
  operationally, at the cost of less control over the runtime
  environment than a container would give.

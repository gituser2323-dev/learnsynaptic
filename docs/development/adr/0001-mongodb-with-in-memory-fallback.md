# ADR-0001: MongoDB via Mongoose, with an in-memory fallback for zero-config dev/test

**Status: Accepted, implemented.**

## Context

This app needs a real database for production, but also needs to run
with zero setup for local development, CI, and the E2E test suite —
requiring every contributor and every CI run to stand up a real
database before the app even boots would slow down every single
iteration cycle.

## Decision

MongoDB via Mongoose for real persistence, with a parallel in-memory
repository implementation satisfying the exact same TypeScript
interface per entity. `lib/db/registry.ts` selects between them based
on whether `MONGODB_URI` is set. Services never know which backend
they're talking to.

## Consequences

- The app genuinely runs with zero configuration — `npm install && npm
  run dev` works with nothing set in `.env.local`.
- Every entity needs **two** repository implementations, not one — a
  real, ongoing maintenance cost (see
  [`docs/development/contributing.md`](../contributing.md#2--repository-pattern--both-implementations-always)
  for the specific divergence traps this creates).
- The in-memory store is per-process, non-durable, and not shared
  across concurrent serverless instances — never viable for
  production, and this is treated as a hard rule, not a soft
  preference, enforced by `lib/startupValidation.ts`'s loud startup
  warning when `NODE_ENV=production` and `MONGODB_URI` is unset.
- Document/schema flexibility (vs. a relational DB) suited this app's
  actual shape well — many optional, module-added fields across 51
  models, added incrementally across many build passes without a
  single rigid migration for each one.

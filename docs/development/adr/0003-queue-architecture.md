# ADR-0003: A MongoDB-backed scheduler as the queue, not Redis/BullMQ

**Status: Accepted, implemented (RC-3).**

## Context

By RC-3, three real async-work producers already existed independently
(the automation engine's step runner, the WhatsApp campaign scheduler,
the campaign message queue) — all correct, but nothing actually
*drove* them; only a human clicking "Run Due Jobs Now" in the admin UI
ever advanced them. RC-3 had to pick a real queue mechanism, evaluating
Redis/BullMQ (the conventional choice for a Node queue) against this
app's actual deployment target.

## Decision

Extend the existing MongoDB-backed `ScheduledJob` mechanism into a
real, atomic-claim, retry-with-backoff queue, drained by Vercel Cron
hitting a dedicated route (`GET /api/cron/run-due-jobs`) every 5
minutes. Redis/BullMQ was evaluated and **not** adopted.

## Consequences

- No new infrastructure dependency — this app already has MongoDB;
  Redis/BullMQ would be a second stateful service to provision,
  monitor, and back up, for a workload this app's actual job volume
  didn't justify.
- **The real, decisive reason**: this app deploys to Vercel serverless
  functions. BullMQ's worker model assumes an always-running process
  pulling from a queue — there is no such process in a serverless
  deployment; a BullMQ worker would need its own separately-hosted,
  always-on compute, defeating the point of a serverless deployment
  target in the first place.
- A real double-execution race (two overlapping poller invocations
  both processing the same due job) was found and fixed with an atomic
  `findOneAndUpdate`-based claim, plus a stale-claim reclaim window for
  crash/restart recovery — the kind of concurrency correctness a queue
  library would otherwise provide for free, now this app's own
  responsibility to get right (and has been, verified by dedicated
  concurrency tests).
- Job execution happens inside the same cron-triggered serverless
  invocation, bounded by an internal 45-second time budget (always
  finishes the current job, never claims a new one past budget) plus
  an explicit `maxDuration=60` — working around the absence of a
  long-running worker process, not ignoring the constraint.
- If job volume or latency requirements ever outgrow a 5-minute cron
  cadence, this decision would need revisiting — disclosed as a real
  scaling ceiling, not treated as permanent.

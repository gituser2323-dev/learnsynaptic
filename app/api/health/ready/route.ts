import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { IS_MONGODB_CONFIGURED } from "@/config/database";
import { getScheduledJobRepository } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "health" });

/** Bounds how long a dependency check may hang before readiness reports
 *  "down" rather than blocking the probe indefinitely — the same "no
 *  external request should hang forever" posture lib/net/timeouts.ts
 *  applies to outbound provider calls, applied here to this app's own
 *  internal dependency (the database). */
const READINESS_CHECK_TIMEOUT_MS = 5_000;

interface DependencyCheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      // Never keep the process alive just for this timer.
      if (typeof timer === "object" && "unref" in timer) timer.unref();
    }),
  ]);
}

/**
 * GET /api/health/ready
 *
 * RC-3 — real READINESS probe, split out from GET /api/health's pure
 * liveness check per this mission's own explicit "liveness/readiness/
 * dependency-health checks" requirement. Reports whether the app's
 * critical infrastructure — MongoDB, and by extension the MongoDB-backed
 * job scheduler this app uses as its queue (see
 * lib/services/scheduler/schedulerService.ts's own doc comment on why
 * this app has no separate Redis/BullMQ broker to check) — is actually
 * reachable right now, not just configured.
 *
 * The ScheduledJob collection IS this app's queue (one Mongo round trip
 * against it proves both "is Mongo reachable" and "is the queue
 * reachable" simultaneously — there is no separate broker process to
 * probe independently, unlike a Redis-backed queue would need). Checking
 * every other collection individually would be redundant health-check
 * sprawl for one shared connection pool, not a more thorough check.
 *
 * In in-memory mode (IS_MONGODB_CONFIGURED false — local dev only, see
 * config/database.ts) there is no external database to be unreachable:
 * readiness trivially reports ok, since "reachable" is meaningless for
 * process-local memory that's already alive if this handler is running.
 *
 * Never exposes connection strings, credentials, or any other
 * infrastructure detail beyond a boolean + latency + a generic error
 * string — this endpoint is deliberately public (a load balancer /
 * uptime monitor has no admin session), so its response body is held to
 * the same "no sensitive infra details" bar RC-2's error handling
 * already applies to every other public-facing surface.
 */
async function checkDatabaseAndQueue(): Promise<{
  database: DependencyCheckResult;
  queue: DependencyCheckResult & { pendingJobs?: number; deadLetteredJobs?: number };
}> {
  if (!IS_MONGODB_CONFIGURED) {
    return { database: { ok: true }, queue: { ok: true } };
  }

  const startedAt = Date.now();
  try {
    const repository = await getScheduledJobRepository();
    const [pending, deadLettered] = await withTimeout(
      Promise.all([repository.list({ status: "pending" }, 1, 1), repository.list({ status: "dead_lettered" }, 1, 1)]),
      READINESS_CHECK_TIMEOUT_MS,
      "database readiness check",
    );
    const latencyMs = Date.now() - startedAt;
    return {
      database: { ok: true, latencyMs },
      queue: { ok: true, latencyMs, pendingJobs: pending.total, deadLetteredJobs: deadLettered.total },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.error("health.readiness_check_failed", { message });
    return {
      database: { ok: false, error: "unreachable or timed out" },
      queue: { ok: false, error: "unreachable or timed out" },
    };
  }
}

async function handleReadinessCheck(): Promise<NextResponse> {
  const { database, queue } = await checkDatabaseAndQueue();
  const healthy = database.ok && queue.ok;

  return apiSuccess(
    {
      status: healthy ? "ok" : "down",
      timestamp: new Date().toISOString(),
      checks: { database, queue },
    },
    healthy ? 200 : 503,
  );
}

export const GET = withApiRoute("health.ready", handleReadinessCheck, {
  rateLimit: { limit: 60, windowMs: 60_000 },
});

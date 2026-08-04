import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { IS_MONGODB_CONFIGURED } from "@/config/database";

const processStartedAt = Date.now();

/**
 * GET /api/health
 *
 * RC-1/RC-3 — pure LIVENESS probe: "is the process up and able to
 * return a response at all," nothing more. Deliberately public (no
 * requiredRole, same pattern as /api/leads) — a monitor/load-balancer
 * probe has no admin session to present. Deliberately does NOT touch
 * the database or job queue — a dependency outage must never fail
 * liveness (that would make an orchestrator restart a perfectly healthy
 * process because e.g. MongoDB is briefly unreachable). Dependency
 * reachability is GET /api/health/ready's job, not this route's — see
 * that route's own doc comment for the liveness/readiness split
 * rationale.
 */
async function handleHealthCheck(): Promise<NextResponse> {
  return apiSuccess({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - processStartedAt) / 1000),
    database: IS_MONGODB_CONFIGURED ? "configured" : "in-memory",
  });
}

export const GET = withApiRoute("health.check", handleHealthCheck, {
  rateLimit: { limit: 120, windowMs: 60_000 },
});

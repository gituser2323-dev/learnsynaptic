import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { runPreflightChecks } from "@/lib/services/systemHealth/preflightService";

/**
 * GET /api/admin/system/preflight
 *
 * RC-4 — Deployment & Production Infrastructure. The live, already-
 * deployed-instance equivalent of `npm run preflight` (scripts/
 * preflightCheck.ts) — there's no shell access into a real Vercel
 * deployment, so this is how an admin actually sees "is production
 * correctly configured" without redeploying with debug logging. Same
 * "report state, never expose a secret VALUE" posture GET
 * /api/health/ready already established: every category here is a
 * boolean/status + a human-readable detail string, never a credential.
 *
 * Deliberately requiredRole: "admin" (not a platform-only secret gate)
 * — the existing AdminSettingsSnapshot (GET /api/admin/settings) already
 * exposes equivalent deployment-wide boolean flags ("JWT signing
 * secret: configured", "MongoDB: configured") to any organization's own
 * admin; this route reports the same category of information at
 * greater depth, not a new privilege tier.
 */
async function handlePreflightCheck(): Promise<NextResponse> {
  const report = await runPreflightChecks();
  return apiSuccess({ report });
}

export const GET = withApiRoute("admin.system.preflight", handlePreflightCheck, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

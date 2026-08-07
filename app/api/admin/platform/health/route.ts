import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { runPreflightChecks } from "@/lib/services/systemHealth/preflightService";

/**
 * GET /api/admin/platform/health
 *
 * RC-6 — reuses RC-3/RC-4's own `runPreflightChecks()` wholesale (the
 * same report `npm run preflight` and the pre-existing
 * `GET /api/admin/system/preflight` produce) — never a second health-
 * check implementation. Distinct from that existing route only in its
 * gate: platform-role instead of tenant `requiredRole: "admin"`, so
 * this specific deployment-wide infrastructure view isn't reachable by
 * an ordinary tenant admin. Never exposes secrets/raw credentials — see
 * preflightService's own doc comment.
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleGetHealth(_request: Request, _ctx: ApiRouteContext): Promise<NextResponse> {
  const report = await runPreflightChecks();
  return apiSuccess({ report });
}

export const GET = withApiRoute("platform.health", handleGetHealth, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

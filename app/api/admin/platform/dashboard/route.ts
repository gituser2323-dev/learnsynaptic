import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getPlatformDashboardSnapshot } from "@/lib/services/platformAdmin";

/**
 * GET /api/admin/platform/dashboard
 *
 * RC-6 — Platform Super Admin & SaaS Operations Console: the owner-level
 * SaaS dashboard, built entirely from real data (see
 * platformDashboardService's own doc comment for exactly how each field
 * is derived — no fabricated/placeholder metrics).
 *
 * ⚠️ requiredPlatformRole: "super_admin" — also enforces MFA (see
 * withApiRoute.ts).
 */
async function handleGetDashboard(_request: Request, _ctx: ApiRouteContext): Promise<NextResponse> {
  const snapshot = await getPlatformDashboardSnapshot();
  return apiSuccess({ snapshot });
}

export const GET = withApiRoute("platform.dashboard", handleGetDashboard, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

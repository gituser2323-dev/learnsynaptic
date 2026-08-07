import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { listPlatformAuditEvents } from "@/lib/services/platformAdmin";

/**
 * GET /api/admin/platform/audit-log
 *
 * RC-6 — every sensitive platform operation, queryable: org suspended/
 * reactivated, plan changed, feature/limit overridden, trial extended,
 * job retried, super-admin granted/revoked. Cross-tenant by nature —
 * an operator reviewing their own actions (or another operator's)
 * needs to see every organization's platform-level history, not just
 * one.
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleListAuditEvents(request: Request, _ctx: ApiRouteContext): Promise<NextResponse> {
  const url = new URL(request.url);
  const { page, limit } = parsePaginationParams(url.searchParams);
  const result = await listPlatformAuditEvents(page, limit);
  return apiSuccess({ result });
}

export const GET = withApiRoute("platform.auditLog.list", handleListAuditEvents, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

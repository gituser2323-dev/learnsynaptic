import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { listPlatformSecurityEvents } from "@/lib/services/platformAdmin";

/**
 * GET /api/admin/platform/security-events
 *
 * RC-6 — cross-tenant security-event visibility (repeated failed
 * logins, lockouts, MFA failures, credential changes, platform-admin
 * actions), reusing RC-1/RC-2's own security audit log. Deliberately
 * not a full SIEM — filtered/paginated reads over the existing
 * AuditLog collection, nothing more.
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleListSecurityEvents(request: Request, _ctx: ApiRouteContext): Promise<NextResponse> {
  const url = new URL(request.url);
  const { page, limit } = parsePaginationParams(url.searchParams);
  const action = url.searchParams.get("action") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const result = await listPlatformSecurityEvents({ action, search }, page, limit);
  return apiSuccess({ result });
}

export const GET = withApiRoute("platform.securityEvents.list", handleListSecurityEvents, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";

/**
 * GET /api/admin/integrations/[providerId]/logs
 *
 * Integrations Hub (Phase 6), Module 6.1 — "Integration Logs" / "Sync
 * Logs": every connect/disconnect/enable/disable/config-update/sync/
 * health-check event for this provider, newest first. Read-only, no
 * existence check on providerId (an unknown or never-connected
 * provider simply has an empty log list — same "list doesn't 404"
 * design already used for 5.3's conversation-insights history route).
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleListLogs(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const result = await integrationService.listLogs(providerId, page, limit);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.integrations.logs.list", handleListLogs, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

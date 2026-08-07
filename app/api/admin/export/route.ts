import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { exportService } from "@/lib/services/dataExport";

/**
 * POST /api/admin/export
 *
 * RC-5 — Backup, Restore & Disaster Recovery: request a full
 * organization-level data export (leads, activities, tasks,
 * opportunities, conversations, campaigns, automation definitions,
 * payment history, org config). Returns immediately with a pending
 * request id — generation runs as a background job
 * (lib/services/dataExport/jobHandler.ts); poll
 * `GET /api/admin/export/[id]` for status and, once complete, a
 * time-limited download URL.
 *
 * ⚠️ requiredRole: "admin" — a full-organization data export is at
 * least as sensitive as bulk-deleting records (see
 * app/api/admin/leads/bulk's own RBAC note); reserved for the top tier,
 * same reasoning.
 */
async function handleRequestExport(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const userId = ctx.authContext.userId;
  if (!userId) throw new UnauthorizedApiError();

  const request = await exportService.requestExport(userId, { actorId: userId, requestId: ctx.requestId });
  return apiSuccess({ request });
}

export const POST = withApiRoute("admin.export.request", handleRequestExport, {
  requiredRole: "admin",
  rateLimit: { limit: 5, windowMs: 60_000 },
});

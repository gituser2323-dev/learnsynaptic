import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { exportService } from "@/lib/services/dataExport";

/**
 * GET /api/admin/export/[id]
 *
 * RC-5 — poll an export request's status; once `status: "completed"`,
 * the response includes a short-lived signed `downloadUrl`. Tenant
 * isolation is enforced by `exportService.getExportStatus` itself (both
 * `DataExportRequest` and `FileAsset` carry `tenantScopePlugin`) — an
 * id belonging to another organization resolves as not-found here, the
 * same as any other cross-tenant lookup in this app. See
 * exportService.ts's own doc comment for why that's true by
 * construction, not by this route remembering to check.
 *
 * ⚠️ requiredRole: "admin" — same tier as the request route.
 */
async function handleGetExportStatus(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const status = await exportService.getExportStatus(id);
  if (!status.found) throw new NotFoundApiError("DataExportRequest", id);

  return apiSuccess({ request: status.request, downloadUrl: status.downloadUrl });
}

export const GET = withApiRoute("admin.export.status", handleGetExportStatus, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

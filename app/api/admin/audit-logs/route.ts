import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams } from "@/lib/api";
import { auditLogService } from "@/lib/services/auditLog";
import type { AuditLogListFilters } from "@/lib/services/auditLog";

/**
 * GET /api/admin/audit-logs
 *
 * Admin Dashboard — Audit Logs page: every Business Audit Event (see
 * AUDIT_ARCHITECTURE.md), filterable by category/entityType/action and
 * searched by entityId/action, paginated. Read-only — audit entries are
 * never editable, only prunable by retention (lib/services/auditLog/retention.ts).
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleListAuditLogs(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filters: AuditLogListFilters = {
    category: (searchParams.get("category") as AuditLogListFilters["category"]) || undefined,
    entityType: (searchParams.get("entityType") as AuditLogListFilters["entityType"]) || undefined,
    action: searchParams.get("action") || undefined,
    search: searchParams.get("search") || undefined,
  };

  const { page, limit } = parsePaginationParams(searchParams);
  const result = await auditLogService.list(filters, page, limit);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.audit_logs.list", handleListAuditLogs, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

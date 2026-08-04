import { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams, toCsv } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { leadService } from "@/lib/services/leads";
import type { LeadListFilters } from "@/lib/services/leads";

/**
 * GET /api/admin/leads
 *
 * Admin Dashboard Backend — Lead Management. Filters: status, source,
 * program, search (name/email/phone/program — widened in Enterprise CRM
 * Phase 1), createdAfter/createdBefore, tags (comma-separated tag ids —
 * see apiClient.ts's buildQuery() for the client-side encoding),
 * assignedCounsellorId, health, archived (defaults to false at the
 * service layer — pass `archived=true` explicitly to see archived
 * leads). Add `?format=csv` to export the full filtered result set
 * instead of one page of JSON — now includes score/health/tags/
 * assignedCounsellorId alongside the original columns.
 *
 * ⚠️ RBAC: "counsellor" tier — but a counsellor only ever sees *their
 * own* assigned leads: `assignedCounsellorId` is force-set to the
 * caller's own id server-side whenever role is "counsellor", overriding
 * whatever the request asked for (same shape as the Tasks list route).
 * This still carries bulk lead PII for manager/admin, so the fail-closed
 * default (deny unless a role is present at all) is unchanged — only the
 * *minimum* tier moved, not the "no anonymous access" guarantee.
 */
async function handleListLeads(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const tagsParam = searchParams.get("tags");
  const archivedParam = searchParams.get("archived");
  const isSelfScoped = ctx.authContext.role === "counsellor";

  const filters: LeadListFilters = {
    status: (searchParams.get("status") as LeadListFilters["status"]) || undefined,
    source: searchParams.get("source") || undefined,
    program: searchParams.get("program") || undefined,
    search: searchParams.get("search") || undefined,
    createdAfter: searchParams.get("createdAfter") || undefined,
    createdBefore: searchParams.get("createdBefore") || undefined,
    tags: tagsParam ? tagsParam.split(",").filter(Boolean) : undefined,
    assignedCounsellorId: isSelfScoped ? ctx.authContext.userId : searchParams.get("assignedCounsellorId") || undefined,
    health: (searchParams.get("health") as LeadListFilters["health"]) || undefined,
    archived: archivedParam === null ? undefined : archivedParam === "true",
  };

  const format = searchParams.get("format");
  if (format === "csv") {
    const { items } = await leadService.listLeads(filters, 1, 5000);
    const csv = toCsv(items, [
      { header: "id", value: (l) => l.id },
      { header: "name", value: (l) => l.name },
      { header: "email", value: (l) => l.email },
      { header: "phone", value: (l) => l.phone },
      { header: "program", value: (l) => l.program },
      { header: "source", value: (l) => l.source },
      { header: "status", value: (l) => l.status },
      { header: "score", value: (l) => l.score },
      { header: "health", value: (l) => l.health },
      { header: "assignedCounsellorId", value: (l) => l.assignedCounsellorId },
      { header: "createdAt", value: (l) => l.createdAt },
    ]);
    return new NextResponse(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=leads.csv" },
    });
  }

  const { page, limit } = parsePaginationParams(searchParams);
  const result = await leadService.listLeads(filters, page, limit);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.leads.list", handleListLeads, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

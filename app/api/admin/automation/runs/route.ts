import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams } from "@/lib/api";
import { listWorkflowRuns } from "@/lib/services/automation";
import type { WorkflowRunListFilters } from "@/lib/services/automation";

/**
 * GET /api/admin/automation/runs
 *
 * Admin Dashboard — Automation page's run history: every WorkflowRun,
 * filterable by status/workflowId/entityType, paginated. Read-only —
 * there is no admin-triggerable "start a run" action; runs are created
 * exclusively by lib/events triggers (see automation/triggers.ts).
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleListRuns(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filters: WorkflowRunListFilters = {
    status: (searchParams.get("status") as WorkflowRunListFilters["status"]) || undefined,
    workflowId: searchParams.get("workflowId") || undefined,
    entityType: searchParams.get("entityType") || undefined,
  };

  const { page, limit } = parsePaginationParams(searchParams);
  const result = await listWorkflowRuns(filters, page, limit);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.automation.runs.list", handleListRuns, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

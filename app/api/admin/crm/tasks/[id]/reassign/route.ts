import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { taskService } from "@/lib/services/crm/tasks";

/**
 * POST /api/admin/crm/tasks/[id]/reassign
 *
 * Enterprise CRM (Phase 1) — Task reassignment, its own audit-worthy
 * action distinct from a generic field edit.
 *
 * ⚠️ requiredRole: "manager" — assignment management (RBAC); a
 * counsellor can complete their own tasks but not hand them to someone
 * else.
 */
async function handleReassignTask(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { assigneeId?: string };
  if (!body.assigneeId) {
    throw new ValidationApiError([{ field: "assigneeId", message: "assigneeId is required." }]);
  }

  const task = await taskService.reassignTask(id, body.assigneeId, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ task });
}

export const POST = withApiRoute("admin.crm.tasks.reassign", handleReassignTask, {
  requiredRole: "manager",
  rateLimit: { limit: 40, windowMs: 60_000 },
});

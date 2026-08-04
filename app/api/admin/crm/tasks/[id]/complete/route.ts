import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { taskService } from "@/lib/services/crm/tasks";

/**
 * POST /api/admin/crm/tasks/[id]/complete
 *
 * Enterprise CRM (Phase 1) — marks a task done; if it's recurring, spawns
 * its next instance from the actual completion date (see
 * taskService.completeTask()'s own comment on why not from the original
 * due date).
 *
 * ⚠️ RBAC: "counsellor" tier — "Complete tasks" is explicitly a
 * Counsellor capability, scoped to their own assigned tasks only.
 */
async function handleCompleteTask(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const existing = await taskService.getTask(id);
  if (!existing) throw new NotFoundApiError("Task", id);
  if (ctx.authContext.role === "counsellor" && existing.assigneeId !== ctx.authContext.userId) {
    throw new ForbiddenApiError("You can only complete your own tasks.");
  }

  const task = await taskService.completeTask(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  return apiSuccess({ task });
}

export const POST = withApiRoute("admin.crm.tasks.complete", handleCompleteTask, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

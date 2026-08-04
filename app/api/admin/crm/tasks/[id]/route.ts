import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, NotFoundApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { taskService } from "@/lib/services/crm/tasks";

/**
 * PATCH /api/admin/crm/tasks/[id]
 *
 * Enterprise CRM (Phase 1) — generic Task edit (title/description/
 * dueAt/priority/reminderAt). Completion and reassignment are their own
 * routes (complete/reassign, both business actions worth their own
 * audit-log entry — see taskService), not folded into this one.
 *
 * ⚠️ RBAC: "counsellor" tier, but only on a task assigned to them —
 * `assigneeId` itself is not editable through this route (that's
 * reassignment, a Manager-tier action) so a counsellor can never use
 * this path to hand their own task to someone else.
 */
async function handleUpdateTask(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const existing = await taskService.getTask(id);
  if (!existing) throw new NotFoundApiError("Task", id);
  if (ctx.authContext.role === "counsellor" && existing.assigneeId !== ctx.authContext.userId) {
    throw new ForbiddenApiError("You can only update your own tasks.");
  }

  const body = (await parseJsonBody(request)) as Record<string, unknown>;
  delete body.assigneeId;
  const task = await taskService.updateTask(id, body as never);
  return apiSuccess({ task });
}

export const PATCH = withApiRoute("admin.crm.tasks.update", handleUpdateTask, {
  requiredRole: "counsellor",
  rateLimit: { limit: 40, windowMs: 60_000 },
});

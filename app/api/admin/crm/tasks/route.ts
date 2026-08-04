import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { taskService } from "@/lib/services/crm/tasks";
import type { TaskListFilters, TaskPriority, TaskStatus } from "@/lib/services/crm/tasks";

/**
 * GET /api/admin/crm/tasks, POST /api/admin/crm/tasks
 *
 * Enterprise CRM (Phase 1) — Task Management. "Counsellor Tasks" (a
 * personal task with no Lead link) and "Lead Tasks" (entityType: "Lead")
 * are both just Task rows here — no separate endpoint per kind.
 *
 * ⚠️ RBAC: "counsellor" tier — but a counsellor only ever sees or
 * creates their *own* tasks. `assigneeId` is force-set to the caller's
 * own id server-side whenever role is "counsellor", overriding whatever
 * the request asked for — the same "server decides, client can't
 * override" shape leadService's scoring/won-lost fields already use.
 * Manager/admin get the full, unscoped view.
 */
async function handleListTasks(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const isSelfScoped = ctx.authContext.role === "counsellor";
  const filters: TaskListFilters = {
    assigneeId: isSelfScoped ? ctx.authContext.userId : searchParams.get("assigneeId") || undefined,
    status: (searchParams.get("status") as TaskStatus) || undefined,
    priority: (searchParams.get("priority") as TaskPriority) || undefined,
    entityType: (searchParams.get("entityType") as "Lead") || undefined,
    entityId: searchParams.get("entityId") || undefined,
    dueBefore: searchParams.get("dueBefore") || undefined,
    dueAfter: searchParams.get("dueAfter") || undefined,
  };
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;

  const result = await taskService.listTasks(filters, page, limit);
  return apiSuccess({ ...result });
}

async function handleCreateTask(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = (await parseJsonBody(request)) as Record<string, unknown>;
  const isSelfScoped = ctx.authContext.role === "counsellor";
  const input = isSelfScoped ? { ...body, assigneeId: ctx.authContext.userId } : body;

  const result = await taskService.createTask(input, { requestId: ctx.requestId, actorId: ctx.authContext.userId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ task: result.task }, 201);
}

export const GET = withApiRoute("admin.crm.tasks.list", handleListTasks, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.crm.tasks.create", handleCreateTask, {
  requiredRole: "counsellor",
  rateLimit: { limit: 40, windowMs: 60_000 },
});

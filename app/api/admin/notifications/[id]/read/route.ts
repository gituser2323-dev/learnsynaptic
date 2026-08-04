import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { notificationService } from "@/lib/services/crm/notifications";

/**
 * POST /api/admin/notifications/[id]/read
 *
 * Enterprise CRM (Phase 1) — marks one notification read. Scoped to
 * ctx.authContext.userId in the same write as the update (see
 * notificationService.markRead's own comment) — a guessed/enumerated id
 * belonging to someone else silently no-ops rather than mutating it.
 *
 * ⚠️ requiredRole: "counsellor" — any authenticated staff member has
 * their own notifications.
 */
async function handleMarkRead(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const { id } = ctx.params;
  await notificationService.markRead(id, ctx.authContext.userId);
  return apiSuccess({ read: true });
}

export const POST = withApiRoute("admin.notifications.read", handleMarkRead, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

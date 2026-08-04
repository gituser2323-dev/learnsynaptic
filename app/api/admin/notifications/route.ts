import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { notificationService } from "@/lib/services/crm/notifications";

/**
 * GET /api/admin/notifications
 *
 * Enterprise CRM (Phase 1) — the current user's Task-reminder
 * notifications (see the module doc comment in
 * lib/services/crm/notifications/types.ts for why this is scoped to
 * Task reminders only, not a general notification system).
 *
 * ⚠️ requiredRole: "counsellor" — any authenticated staff member has
 * their own notifications; scoped to ctx.authContext.userId, never a
 * caller-supplied userId, so one user can never read another's.
 */
async function handleListNotifications(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const limit = Number(searchParams.get("limit")) || 20;

  const [notifications, unreadCount] = await Promise.all([
    notificationService.listForUser(ctx.authContext.userId, unreadOnly, limit),
    notificationService.countUnread(ctx.authContext.userId),
  ]);

  return apiSuccess({ notifications, unreadCount });
}

export const GET = withApiRoute("admin.notifications.list", handleListNotifications, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

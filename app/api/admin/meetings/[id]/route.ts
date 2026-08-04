import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { calendarService } from "@/lib/services/calendar";

/**
 * GET /api/admin/meetings/[id], PATCH /api/admin/meetings/[id],
 * DELETE /api/admin/meetings/[id]
 *
 * Calendar & Meeting Connectors (Phase 6), Module 6.3 — DELETE cancels
 * (both the real vendor event and this app's own record — see
 * calendarService.cancelMeeting's own doc comment); it never hard-
 * deletes, matching FileAsset's soft-delete precedent from 6.2, since
 * "Sync History"/"Meeting Status" both imply the row and its history
 * persist across a cancellation.
 *
 * ⚠️ requiredRole: "counsellor" — same floor tier as the schedule/list route.
 */
async function handleGetMeeting(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const meeting = await calendarService.getMeeting(id);
  if (!meeting || meeting.deletedAt) throw new NotFoundApiError("Meeting", id);
  return apiSuccess({ meeting });
}

async function handleUpdateMeeting(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) throw new ValidationApiError([{ field: "root", message: "Request body must be valid JSON." }]);

  const result = await calendarService.updateMeeting(id, body, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!result.success) {
    if (result.errors.some((e) => e.field === "id")) throw new NotFoundApiError("Meeting", id);
    throw new ValidationApiError(result.errors);
  }
  return apiSuccess({ meeting: result.meeting });
}

async function handleCancelMeeting(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const meeting = await calendarService.cancelMeeting(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!meeting) throw new NotFoundApiError("Meeting", id);
  return apiSuccess({ meeting });
}

export const GET = withApiRoute("admin.meetings.get", handleGetMeeting, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const PATCH = withApiRoute("admin.meetings.update", handleUpdateMeeting, {
  requiredRole: "counsellor",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const DELETE = withApiRoute("admin.meetings.cancel", handleCancelMeeting, {
  requiredRole: "counsellor",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

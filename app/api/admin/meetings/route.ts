import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError, parsePaginationParams } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { calendarService } from "@/lib/services/calendar";
import type { MeetingStatus } from "@/lib/services/calendar";

const MEETING_STATUSES: MeetingStatus[] = ["scheduled", "confirmed", "cancelled", "completed"];

/**
 * POST /api/admin/meetings, GET /api/admin/meetings
 *
 * Calendar & Meeting Connectors (Phase 6), Module 6.3 — the ONE
 * generic scheduling/list endpoint every business module should call
 * (Lead meetings, future Opportunity meetings), mirroring
 * app/api/admin/files/route.ts's own shape exactly for the same
 * reason: no bespoke per-module scheduling route.
 *
 * ⚠️ requiredRole: "counsellor" — the floor tier Leads/Activities/Files
 * already use (a counsellor must be able to schedule a meeting with
 * their own lead); the connected calendar PROVIDER itself is still
 * admin-managed (Settings → Integrations), the same split 6.2 already
 * drew between "who can upload a file" and "who can connect AWS S3."
 */
async function handleScheduleMeeting(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body) throw new ValidationApiError([{ field: "root", message: "Request body must be valid JSON." }]);

  const result = await calendarService.scheduleMeeting(body, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!result.success) throw new ValidationApiError(result.errors);
  return apiSuccess({ meeting: result.meeting }, 201);
}

async function handleListMeetings(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const status = searchParams.get("status");
  const result = await calendarService.listMeetings(
    {
      relatedEntityType: searchParams.get("relatedEntityType") || undefined,
      relatedEntityId: searchParams.get("relatedEntityId") || undefined,
      status: status && MEETING_STATUSES.includes(status as MeetingStatus) ? (status as MeetingStatus) : undefined,
    },
    page,
    limit,
  );
  return apiSuccess({ ...result });
}

export const POST = withApiRoute("admin.meetings.schedule", handleScheduleMeeting, {
  requiredRole: "counsellor",
  // Reaches a real vendor calendar API — tighter than a plain CRUD
  // route, the same posture 6.2's own upload route already takes.
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const GET = withApiRoute("admin.meetings.list", handleListMeetings, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

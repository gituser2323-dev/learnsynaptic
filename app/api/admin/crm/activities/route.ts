import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { activityService } from "@/lib/services/crm/activities";
import { leadService } from "@/lib/services/leads";
import type { ActivityEntityType } from "@/lib/services/crm/activities";

/**
 * GET /api/admin/crm/activities?entityType=Lead&entityId=...
 * POST /api/admin/crm/activities
 *
 * Enterprise CRM (Phase 1) — Lead Timeline. GET reads one entity's
 * timeline, reverse-chronological. POST logs a note/call/meeting/email/
 * whatsapp_reference entry by hand ("system" entries are written
 * directly by other services via activityService.logSystemEvent(), not
 * through this route).
 *
 * ⚠️ RBAC: "counsellor" tier, but only for a Lead assigned to them —
 * "Activities" and "Notes" are explicit Counsellor capabilities.
 * Opportunity timelines are Manager+ only (Pipeline/Opportunity
 * management is not in a Counsellor's allowed scope).
 */
async function assertCounsellorCanAccessEntity(
  ctx: ApiRouteContext,
  entityType: ActivityEntityType,
  entityId: string,
): Promise<void> {
  if (ctx.authContext.role !== "counsellor") return;
  if (entityType !== "Lead") {
    throw new ForbiddenApiError("You can only log activity on leads assigned to you.");
  }
  const lead = await leadService.getLead(entityId);
  if (!lead || lead.assignedCounsellorId !== ctx.authContext.userId) {
    throw new ForbiddenApiError("You can only log activity on leads assigned to you.");
  }
}

async function handleListActivities(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") as ActivityEntityType | null;
  const entityId = searchParams.get("entityId");
  if (!entityType || !entityId) {
    throw new ValidationApiError([{ field: "entityType", message: "entityType and entityId are both required." }]);
  }
  await assertCounsellorCanAccessEntity(ctx, entityType, entityId);

  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 50;
  const result = await activityService.listTimeline({ entityType, entityId }, page, limit);
  return apiSuccess({ ...result });
}

async function handleCreateActivity(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = (await parseJsonBody(request)) as Record<string, unknown>;
  const { entityType, entityId, type, body: activityBody, durationMinutes, referenceMessageId } = body;

  if (!entityType || !entityId || !type || !activityBody) {
    throw new ValidationApiError([{ field: "root", message: "entityType, entityId, type, and body are required." }]);
  }
  await assertCounsellorCanAccessEntity(ctx, entityType as ActivityEntityType, entityId as string);

  const activity = await activityService.logActivity({
    entityType: entityType as ActivityEntityType,
    entityId: entityId as string,
    type: type as never,
    body: activityBody as string,
    durationMinutes: durationMinutes as number | undefined,
    referenceMessageId: referenceMessageId as string | undefined,
    actorId: ctx.authContext.userId,
  });

  return apiSuccess({ activity }, 201);
}

export const GET = withApiRoute("admin.crm.activities.list", handleListActivities, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.crm.activities.create", handleCreateActivity, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { platformOrganizationService } from "@/lib/services/organizations";

/**
 * POST /api/admin/platform/organizations/[id]/suspend
 *
 * RC-6 — the mission's own explicit "dangerous action UX" requirement:
 * requires a real, non-empty reason (never a one-click destructive
 * action). Suspension is data-preserving: no data is deleted; writes,
 * campaigns, automation, and provider sends stop (see
 * withApiRoute.ts/schedulerService.ts's own enforcement), historical
 * data/billing/audit logs remain fully intact.
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleSuspend(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as { reason?: string };
  if (!body.reason?.trim()) {
    throw new ValidationApiError([{ field: "reason", message: "A reason is required to suspend an organization." }]);
  }

  const organization = await platformOrganizationService.suspendOrganization(id, body.reason, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ organization });
}

export const POST = withApiRoute("platform.organizations.suspend", handleSuspend, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

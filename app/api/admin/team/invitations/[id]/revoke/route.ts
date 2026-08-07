import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { invitationService } from "@/lib/services/onboarding";

/** POST /api/admin/team/invitations/[id]/revoke — RC-7. Never a hard
 *  delete (mission's own general "never casual destructive deletion"
 *  posture, applied here too) — a revoked invitation stays visible in
 *  the list with a real `revoked`/`revokedAt` history, only its token
 *  stops working. */
async function handleRevoke(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.organizationId) throw new UnauthorizedApiError();
  try {
    const invitation = await invitationService.revokeInvitation(ctx.authContext.organizationId, ctx.params.id, {
      actorId: ctx.authContext.userId,
      requestId: ctx.requestId,
    });
    return apiSuccess({ invitation });
  } catch {
    throw new NotFoundApiError("TeamInvitation", ctx.params.id);
  }
}

export const POST = withApiRoute("admin.team.invitations.revoke", handleRevoke, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

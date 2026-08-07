import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { invitationService } from "@/lib/services/onboarding";

/** POST /api/admin/team/invitations/[id]/resend — RC-7. */
async function handleResend(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.organizationId) throw new UnauthorizedApiError();
  const result = await invitationService.resendInvitation(ctx.authContext.organizationId, ctx.params.id, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  if (!result.success) throw new ValidationApiError(result.errors);
  return apiSuccess({ invitation: result.invitation });
}

export const POST = withApiRoute("admin.team.invitations.resend", handleResend, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60 * 60_000 },
});

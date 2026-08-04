import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { sessionService } from "@/lib/services/auth";

/**
 * POST /api/auth/sessions/revoke-others
 *
 * "Log out all OTHER devices" — never revokes the caller's own current
 * session (this request's own `sessionId` claim is passed as the
 * exclusion), so this endpoint can never accidentally sign the caller
 * themselves out.
 */
async function handleRevokeOthers(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  await sessionService.revokeAllOtherSessions(ctx.authContext.userId, ctx.authContext.sessionId, { requestId: ctx.requestId });
  return apiSuccess({});
}

export const POST = withApiRoute("auth.sessions.revokeOthers", handleRevokeOthers, {
  requiredRole: "counsellor",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

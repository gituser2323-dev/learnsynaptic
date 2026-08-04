import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { sessionService } from "@/lib/services/auth";

/**
 * GET /api/auth/sessions
 *
 * RC-1 — Session Management. Every currently-active session for the
 * CALLER'S OWN account — never accepts a userId parameter, so there is
 * no code path through which one user could list another's sessions.
 * `isCurrent` (this exact request's own session, via the sessionId
 * claim RC-1 added to the access token) lets the UI mark "this device"
 * distinctly from every other one.
 */
async function handleListSessions(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const sessions = await sessionService.listActiveSessions(ctx.authContext.userId, ctx.authContext.sessionId);
  return apiSuccess({ sessions });
}

export const GET = withApiRoute("auth.sessions.list", handleListSessions, {
  requiredRole: "counsellor",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

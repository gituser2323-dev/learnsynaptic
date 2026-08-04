import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { sessionService } from "@/lib/services/auth";

/**
 * GET /api/auth/login-history
 *
 * RC-1 — Login History for the CALLER'S OWN account only — never
 * accepts a userId parameter, same "no cross-account access" posture
 * every other RC-1 self-service route already takes.
 */
async function handleLoginHistory(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const history = await sessionService.listLoginHistory(ctx.authContext.userId);
  return apiSuccess({ history });
}

export const GET = withApiRoute("auth.loginHistory", handleLoginHistory, {
  requiredRole: "counsellor",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

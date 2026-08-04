import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, apiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getClientIp } from "@/lib/api/clientIp";
import { authService } from "@/lib/services/auth";

/**
 * POST /api/auth/change-password
 *
 * Self-service password change for an already-authenticated user
 * (Security Settings). Requires the CURRENT password — see
 * authService.changePassword()'s own doc comment for why. Revokes every
 * OTHER session (never this one), using this request's own
 * `sessionId` claim (RC-1's AccessTokenPayload.sessionId, forwarded by
 * middleware.ts) to know which session to spare.
 */
async function handleChangePassword(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const body = await request.json().catch(() => ({}));
  const result = await authService.changePassword(ctx.authContext.userId, body, ctx.authContext.sessionId, {
    requestId: ctx.requestId,
    ipAddress: getClientIp(request),
  });
  if (!result.success) return apiError(result.errors, 400);
  return apiSuccess({ message: "Your password has been changed." });
}

export const POST = withApiRoute("auth.changePassword", handleChangePassword, {
  requiredRole: "counsellor",
  rateLimit: { limit: 10, windowMs: 15 * 60 * 1000 },
});

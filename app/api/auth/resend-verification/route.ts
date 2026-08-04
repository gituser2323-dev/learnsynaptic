import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { authService } from "@/lib/services/auth";

/**
 * POST /api/auth/resend-verification
 *
 * Re-sends the verification email for the CURRENTLY authenticated
 * user's own address — never accepts a target email in the body (that
 * would let an authenticated user spam verification emails to an
 * arbitrary address). Reports the real current state (`already_verified`
 * vs. `sent`) — no enumeration risk here, since it's always about the
 * caller's own account.
 */
async function handleResendVerification(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const result = await authService.requestEmailVerification(ctx.authContext.userId, { requestId: ctx.requestId });
  return apiSuccess({ status: result.status });
}

export const POST = withApiRoute("auth.resendVerification", handleResendVerification, {
  requiredRole: "counsellor",
  rateLimit: { limit: 5, windowMs: 15 * 60 * 1000 },
});

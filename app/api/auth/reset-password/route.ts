import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, apiError } from "@/lib/api";
import { getClientIp } from "@/lib/api/clientIp";
import { authService } from "@/lib/services/auth";

/**
 * POST /api/auth/reset-password
 *
 * Body: { token, newPassword }. Completes a self-service reset —
 * verifies the single-use token, sets the new password, and revokes
 * every session for the account (see authService.completePasswordReset()'s
 * own doc comment for why, distinct from the CLI-operator reset path).
 * No requiredRole: presenting a valid reset token IS the credential
 * here, the same as /login's password or /refresh's refresh cookie.
 */
async function handleResetPassword(request: Request, ctx: { requestId: string }): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const result = await authService.completePasswordReset(body, { requestId: ctx.requestId, ipAddress: getClientIp(request) });
  if (!result.success) return apiError(result.errors, 400);
  return apiSuccess({ message: "Your password has been reset. Please sign in with your new password." });
}

export const POST = withApiRoute("auth.resetPassword", handleResetPassword, {
  rateLimit: { limit: 10, windowMs: 15 * 60 * 1000 },
});

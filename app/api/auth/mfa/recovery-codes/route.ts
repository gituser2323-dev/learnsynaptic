import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ForbiddenApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getUserRepository } from "@/lib/db";
import { mfaService } from "@/lib/services/auth";

/**
 * POST /api/auth/mfa/recovery-codes
 *
 * Regenerates the 10 recovery codes — invalidates every existing one
 * first (never leaves an old set valid alongside a new one), returns
 * the new set in PLAINTEXT exactly once. Only meaningful for an
 * account that already has MFA enabled — rejected otherwise, since
 * there'd be nothing for a recovery code to recover into.
 */
async function handleRegenerateRecoveryCodes(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const userRepository = await getUserRepository();
  const user = await userRepository.findById(ctx.authContext.userId);
  if (!user?.mfaEnabled) throw new ForbiddenApiError("MFA is not enabled on this account.");

  const recoveryCodes = await mfaService.regenerateRecoveryCodes(ctx.authContext.userId);
  return apiSuccess({ recoveryCodes });
}

export const POST = withApiRoute("auth.mfa.regenerateRecoveryCodes", handleRegenerateRecoveryCodes, {
  requiredRole: "counsellor",
  rateLimit: { limit: 5, windowMs: 60_000 },
});

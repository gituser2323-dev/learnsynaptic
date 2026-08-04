import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, apiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { mfaService } from "@/lib/services/auth";

/**
 * POST /api/auth/mfa/confirm
 *
 * Step 2 of enabling MFA: body { code } — the user's own first real
 * TOTP code from their authenticator app. On success, MFA flips ON and
 * 10 single-use recovery codes are returned in PLAINTEXT exactly once
 * — the UI must show these immediately with a "save these somewhere
 * safe" prompt; they can never be retrieved again after this response.
 */
async function handleMfaConfirm(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  if (typeof body.code !== "string" || !body.code) {
    return apiError([{ field: "code", message: "A verification code is required." }], 400);
  }
  const result = await mfaService.confirmSetup(ctx.authContext.userId, body.code, { requestId: ctx.requestId });
  if (!result.success) return apiError([{ field: "code", message: result.error }], 400);
  return apiSuccess({ recoveryCodes: result.recoveryCodes });
}

export const POST = withApiRoute("auth.mfa.confirm", handleMfaConfirm, {
  requiredRole: "counsellor",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

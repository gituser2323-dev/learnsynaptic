import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, apiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { mfaService } from "@/lib/services/auth";

/**
 * POST /api/auth/mfa/disable
 *
 * Body: { currentPassword }. Requires re-entering the current password
 * — the same "prove you're still really you" requirement
 * authService.changePassword() already applies — disabling MFA is
 * exactly the kind of security-downgrade action a hijacked-but-still-
 * open session shouldn't be able to do without it. Also revokes every
 * trusted-device grant (mfaService.disable()'s own doc comment covers
 * why).
 */
async function handleMfaDisable(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const body = (await request.json().catch(() => ({}))) as { currentPassword?: unknown };
  if (typeof body.currentPassword !== "string" || !body.currentPassword) {
    return apiError([{ field: "currentPassword", message: "Current password is required." }], 400);
  }

  const result = await mfaService.disable(ctx.authContext.userId, body.currentPassword, { requestId: ctx.requestId });
  if (!result.success) return apiError([{ field: "currentPassword", message: result.error }], 400);
  return apiSuccess({});
}

export const POST = withApiRoute("auth.mfa.disable", handleMfaDisable, {
  requiredRole: "counsellor",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

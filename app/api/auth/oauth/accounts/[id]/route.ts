import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { oauthService } from "@/lib/services/auth";

/**
 * DELETE /api/auth/oauth/accounts/[id]
 *
 * "Disconnect this provider" — unlinks exactly one of the CALLER'S OWN
 * connected provider identities. oauthService.unlinkAccount() verifies
 * ownership before deleting anything; a 404 (not 403) for someone
 * else's account id, the same convention /api/auth/sessions/[id] and
 * /api/auth/mfa/trusted-devices/[id] already establish.
 */
async function handleUnlinkAccount(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const { id } = ctx.params;
  const result = await oauthService.unlinkAccount(ctx.authContext.userId, id, { requestId: ctx.requestId });
  if (!result.success) throw new NotFoundApiError("Connected account", id);
  return apiSuccess({});
}

export const DELETE = withApiRoute("auth.oauth.accounts.unlink", handleUnlinkAccount, {
  requiredRole: "counsellor",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

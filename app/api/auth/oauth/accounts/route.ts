import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { oauthService } from "@/lib/services/auth";

/**
 * GET /api/auth/oauth/accounts
 *
 * Connected Accounts panel's own data source — every provider identity
 * the caller has linked to their own account.
 */
async function handleListAccounts(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const accounts = await oauthService.listLinkedAccounts(ctx.authContext.userId);
  return apiSuccess({
    accounts: accounts.map((a) => ({ id: a.id, provider: a.provider, email: a.email, createdAt: a.createdAt })),
  });
}

export const GET = withApiRoute("auth.oauth.accounts.list", handleListAccounts, {
  requiredRole: "counsellor",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

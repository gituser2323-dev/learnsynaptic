import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { withApiRoute, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { oauthService, verifyAccessToken, OAuthProviderNotConfiguredError } from "@/lib/services/auth";
import { AUTH_ACCESS_COOKIE_NAME } from "@/config/auth";

/**
 * GET /api/auth/oauth/[provider]/authorize
 *
 * Redirects the browser to the real vendor consent screen. No
 * `requiredRole` — this is deliberately reachable by a request with no
 * session at all (an unauthenticated visitor choosing "Sign in with
 * Google"), so it's NOT in middleware.ts's matcher and never gets
 * trustworthy x-auth-* headers. Instead it verifies the access-token
 * cookie itself (the exact same `verifyAccessToken` primitive
 * middleware.ts uses) to decide the intent: a valid session present
 * means an already-logged-in user is CONNECTING a new provider to their
 * own account ("link"); no valid session means an unauthenticated
 * visitor is SIGNING IN ("intent" is threaded through the signed OAuth
 * `state` param — see oauth/state.ts — so the callback doesn't need to
 * re-derive it from a second cookie check that could disagree with this
 * one).
 */
async function handleAuthorize(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { provider } = ctx.params;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_ACCESS_COOKIE_NAME)?.value;
  const claims = accessToken ? await verifyAccessToken(accessToken) : null;

  try {
    const url = oauthService.beginAuthorization(provider, claims?.sub);
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof OAuthProviderNotConfiguredError) {
      throw new ValidationApiError([{ field: "provider", message: error.message }]);
    }
    throw error;
  }
}

export const GET = withApiRoute("auth.oauth.authorize", handleAuthorize, {
  rateLimit: { limit: 20, windowMs: 60_000 },
});

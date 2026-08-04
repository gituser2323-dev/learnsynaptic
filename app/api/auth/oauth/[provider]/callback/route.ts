import { NextResponse } from "next/server";
import { withApiRoute } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getClientIp } from "@/lib/api/clientIp";
import { setAuthCookies } from "@/lib/api/cookies";
import {
  oauthService,
  OAuthAccountAlreadyLinkedError,
  OAuthAccountDisabledError,
  OAuthAccountNotLinkedError,
} from "@/lib/services/auth";

const LOGIN_PAGE = "/admin/login";
const SETTINGS_PAGE = "/admin/settings";

/**
 * GET /api/auth/oauth/[provider]/callback
 *
 * Where the vendor redirects the browser back to after consent. Not
 * behind `requiredRole` for the same reason authorize/route.ts isn't —
 * a "login" intent callback arrives with no session at all. Always
 * redirects to a real page (never a raw JSON body) — this is a
 * full-page navigation the user is sitting in front of, the identical
 * UX reasoning /api/admin/integrations/[providerId]/oauth/callback
 * already established. Vendor/internal error detail is never put in
 * the redirect URL a browser history/referrer could retain — only a
 * short, safe, generic code (see that same precedent).
 */
async function handleCallback(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { provider } = ctx.params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const vendorError = searchParams.get("error");

  const context = { requestId: ctx.requestId, ipAddress: getClientIp(request), userAgent: request.headers.get("user-agent") ?? undefined };

  if (vendorError || !code || !state) {
    const url = new URL(LOGIN_PAGE, request.url);
    url.searchParams.set("oauthError", vendorError ? "denied" : "invalid_request");
    return NextResponse.redirect(url);
  }

  try {
    const result = await oauthService.handleCallback(provider, code, state, context);

    if (result.intent === "link") {
      const url = new URL(SETTINGS_PAGE, request.url);
      url.searchParams.set("oauthLinked", result.account.provider);
      return NextResponse.redirect(url);
    }

    if (result.mfaRequired) {
      const url = new URL(LOGIN_PAGE, request.url);
      url.searchParams.set("oauthMfaPending", result.pendingToken);
      url.searchParams.set("oauthProvider", provider);
      return NextResponse.redirect(url);
    }

    const response = NextResponse.redirect(new URL("/admin", request.url));
    setAuthCookies(response, result.tokens);
    return response;
  } catch (error) {
    const isLinkError = error instanceof OAuthAccountAlreadyLinkedError;
    const url = new URL(isLinkError ? SETTINGS_PAGE : LOGIN_PAGE, request.url);
    if (error instanceof OAuthAccountNotLinkedError) {
      url.searchParams.set("oauthError", "not_linked");
    } else if (error instanceof OAuthAccountDisabledError) {
      url.searchParams.set("oauthError", "account_disabled");
    } else if (isLinkError) {
      url.searchParams.set("oauthError", "already_linked");
    } else {
      url.searchParams.set("oauthError", "connection_failed");
    }
    return NextResponse.redirect(url);
  }
}

export const GET = withApiRoute("auth.oauth.callback", handleCallback, {
  rateLimit: { limit: 20, windowMs: 60_000 },
});

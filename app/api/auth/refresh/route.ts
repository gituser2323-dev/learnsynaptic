import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, apiError, setAuthCookies, clearAuthCookies } from "@/lib/api";
import { getClientIp } from "@/lib/api/clientIp";
import { authService } from "@/lib/services/auth";
import { AUTH_REFRESH_COOKIE_NAME } from "@/config/auth";

const REFRESH_FAILURE_MESSAGES: Record<string, string> = {
  invalid: "Session expired. Please log in again.",
  expired: "Session expired. Please log in again.",
  user_inactive: "This account is no longer active.",
  reused: "Session invalidated for your security. Please log in again.",
};

/**
 * POST /api/auth/refresh
 *
 * Reads the refresh cookie (scoped to /api/auth — see config/auth.ts),
 * rotates it (old token revoked, new one issued in the same family —
 * see authService.refreshSession()'s doc comment on reuse detection),
 * and sets fresh cookies. No requiredRole: presenting a valid refresh
 * token IS the credential here, the same way a password is for /login.
 *
 * Any failure clears both cookies — a rejected refresh should never
 * leave a stale, unusable cookie pair sitting in the browser.
 */
async function handleRefresh(request: Request, ctx: { requestId: string }): Promise<NextResponse> {
  const cookieStore = await cookies();
  const rawRefreshToken = cookieStore.get(AUTH_REFRESH_COOKIE_NAME)?.value;

  const result = await authService.refreshSession(rawRefreshToken, { requestId: ctx.requestId, ipAddress: getClientIp(request) });

  if (!result.success) {
    const message = REFRESH_FAILURE_MESSAGES[result.reason] ?? REFRESH_FAILURE_MESSAGES.invalid;
    // Built and returned directly, not thrown: an ApiError thrown here
    // would be caught by withApiRoute's handleApiError, which builds an
    // entirely new response object — any cookie mutation made before
    // throwing would be silently lost. clearAuthCookies only takes
    // effect on the exact response object actually returned.
    const response = apiError([{ field: "root", message }], 401);
    clearAuthCookies(response);
    return response;
  }

  const response = apiSuccess({ user: result.user });
  setAuthCookies(response, result.tokens);
  return response;
}

export const POST = withApiRoute("auth.refresh", handleRefresh, {
  rateLimit: { limit: 30, windowMs: 60_000 },
});

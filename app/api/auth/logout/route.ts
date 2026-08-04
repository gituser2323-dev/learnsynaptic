import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, clearAuthCookies } from "@/lib/api";
import { getClientIp } from "@/lib/api/clientIp";
import { authService } from "@/lib/services/auth";
import { AUTH_REFRESH_COOKIE_NAME } from "@/config/auth";

/**
 * POST /api/auth/logout
 *
 * Revokes the presented refresh token server-side (so it can't be
 * replayed even if it leaked before this call) and clears both cookies.
 * Always responds 200, even if there was no valid session to log out of
 * — logout is idempotent by design, same reasoning as DELETE endpoints
 * elsewhere not erroring on an already-absent resource.
 */
async function handleLogout(request: Request, ctx: { requestId: string }): Promise<NextResponse> {
  const cookieStore = await cookies();
  const rawRefreshToken = cookieStore.get(AUTH_REFRESH_COOKIE_NAME)?.value;

  await authService.logout(rawRefreshToken, { requestId: ctx.requestId, ipAddress: getClientIp(request) });

  const response = apiSuccess({});
  clearAuthCookies(response);
  return response;
}

export const POST = withApiRoute("auth.logout", handleLogout, {
  rateLimit: { limit: 30, windowMs: 60_000 },
});

import { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, setAuthCookies, UnauthorizedApiError } from "@/lib/api";
import { getClientIp } from "@/lib/api/clientIp";
import { isSameOriginRequest } from "@/lib/api/verifySameOrigin";
import { authService } from "@/lib/services/auth";

/**
 * POST /api/auth/login
 *
 * Body: { email, password, rememberMe?, mfaCode?, trustedDeviceToken? }.
 * On success, sets the access + refresh cookies (httpOnly — never
 * returned in the response body) and returns the public user record
 * plus whether this was a new-device sign-in. On a wrong-credentials
 * failure, responds 401 with a generic message; see authService.login()'s
 * doc comment for why login failure modes aren't distinguished (email
 * enumeration).
 *
 * RC-1 — two other real, non-error outcomes now exist beyond plain
 * success/failure, both returned as 200 with their own distinguishing
 * body shape (never a 401 — presenting a valid password but needing a
 * second factor, or being temporarily locked, isn't "wrong credentials"):
 *  - `{ mfaRequired: true }` — the client should prompt for a TOTP/
 *    recovery code and POST here again with the SAME credentials plus
 *    `mfaCode` (see LoginResult's own doc comment for why this reuses
 *    the same endpoint rather than a second "step 2" route).
 *  - `{ locked: true, lockedUntil }` — too many recent failed attempts;
 *    the client should show a real countdown/message, not a generic
 *    "wrong password."
 *
 * Rate-limited at 10 attempts / 15 minutes per IP — the one route in
 * this module that's a real brute-force target (a real per-ACCOUNT
 * lockout also exists now — see authService.ts's own checkAndRecordFailedLogin).
 *
 * RC-2 — same-origin checked (isSameOriginRequest, the identical
 * anti-CSRF technique /api/leads and /api/registrations already use
 * for their own anonymous-write surface): unlike every other write
 * endpoint in this app, login happens BEFORE any session cookie
 * exists, so `sameSite=lax`'s own CSRF mitigation — which every
 * *authenticated* mutation in this app relies on — provides zero
 * protection here. Without this check, a forged cross-site POST could
 * log a victim's browser into an attacker-controlled account using the
 * attacker's own known credentials ("login CSRF") — the victim then
 * unknowingly acts (e.g. uploads files, saves data) inside the
 * attacker's session while believing it's their own.
 */
async function handleLogin(request: Request, ctx: { requestId: string }): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) throw new UnauthorizedApiError([{ field: "root", message: "Invalid request origin." }]);
  const body = await parseJsonBody(request);
  const result = await authService.login(body, {
    requestId: ctx.requestId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  if (!result.success) {
    if ("mfaRequired" in result) return apiSuccess({ mfaRequired: true });
    if ("locked" in result) return apiSuccess({ locked: true, lockedUntil: result.lockedUntil });
    throw new UnauthorizedApiError(result.errors);
  }

  const response = apiSuccess({ user: result.user, newDevice: result.newDevice });
  setAuthCookies(response, result.tokens);
  return response;
}

export const POST = withApiRoute("auth.login", handleLogin, {
  rateLimit: { limit: 10, windowMs: 15 * 60 * 1000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, setAuthCookies, ValidationApiError, UnauthorizedApiError } from "@/lib/api";
import { getClientIp } from "@/lib/api/clientIp";
import { isSameOriginRequest } from "@/lib/api/verifySameOrigin";
import { assertEmailTargetRateLimitOk } from "@/lib/api/targetRateLimit";
import { authService } from "@/lib/services/auth";

/**
 * POST /api/auth/register
 *
 * RC-7 — Customer Onboarding & SaaS Activation. The first hop of the
 * NEW USER -> ACCOUNT funnel: real self-service account creation,
 * something this app never had before (every prior account was
 * provisioned out-of-band via scripts/createAdminUser.ts — see
 * authService.createUser()'s own doc comment, left untouched).
 *
 * Body: { email, name, password, termsAccepted }. No `role` — see
 * authService.registerUser()'s own doc comment for why that's fixed,
 * not client-chosen. On success, auto-signs the new account in (sets
 * the same httpOnly access/refresh cookies login does) and fires a
 * verification email — the client's own onboarding wizard is what
 * decides whether the "create your organization" step is reachable yet
 * (gated on `user.emailVerifiedAt`, the same field the rest of this app
 * already uses), while withApiRoute.ts's own pre-organization gate
 * (see its "RC-7" doc comment) is the REAL server-side enforcement of
 * which routes this session can reach before an organization exists —
 * this route just establishes that session.
 *
 * Same anti-CSRF same-origin check login/route.ts uses and for the
 * identical reason: this happens before any session cookie exists, so
 * SameSite=Lax provides no protection on its own — a forged cross-site
 * POST could otherwise create + auto-login an attacker-controlled
 * account inside a victim's browser ("registration CSRF"), tricking
 * them into unknowingly entering real business data into an account
 * they don't control.
 *
 * Rate-limited generously tighter than login's own 10/15min (a
 * brute-force login target isn't the concern here — registration spam/
 * automated account creation is) but loose enough not to punish a
 * legitimate business signing up a handful of real staff accounts in
 * quick succession later via the invite flow (a separate route/limit).
 */
async function handleRegister(request: Request, ctx: { requestId: string }): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) throw new UnauthorizedApiError([{ field: "root", message: "Invalid request origin." }]);
  const body = await parseJsonBody(request);
  // RC-9 — second rate-limit dimension keyed on the target email, not
  // just client IP — see lib/api/targetRateLimit.ts's own doc comment.
  // Closes repeated-registration-attempt spam against one email (a
  // verification-email flood vector) surviving an X-Forwarded-For-
  // spoofed bypass of the IP-keyed limit below.
  await assertEmailTargetRateLimitOk("auth.register", (body as { email?: unknown })?.email, 5, 15 * 60 * 1000);
  const result = await authService.registerUser(body, {
    requestId: ctx.requestId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  const response = apiSuccess({ user: result.user }, 201);
  setAuthCookies(response, result.tokens);
  return response;
}

export const POST = withApiRoute("auth.register", handleRegister, {
  rateLimit: { limit: 5, windowMs: 15 * 60 * 1000 },
});

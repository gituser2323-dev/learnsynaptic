import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { getClientIp } from "@/lib/api/clientIp";
import { assertEmailTargetRateLimitOk } from "@/lib/api/targetRateLimit";
import { authService } from "@/lib/services/auth";

/**
 * POST /api/auth/forgot-password
 *
 * RC-1 — real self-service password recovery. Always responds 200 with
 * the same generic body regardless of whether the email matches a real
 * account (authService.requestPasswordReset()'s own doc comment covers
 * why — the same anti-enumeration principle /login's generic error
 * already applies). No requiredRole: this is, by definition, for a user
 * who can't sign in.
 *
 * Rate-limited — a real target for someone trying to spam a victim's
 * inbox with reset emails, or to probe which addresses have accounts by
 * timing (mitigated by "always 200, always the same message," but the
 * rate limit is real defense-in-depth against the spam case regardless).
 */
async function handleForgotPassword(request: Request, ctx: { requestId: string }): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  // RC-9 — a real, live-proven gap: the route-level rateLimit option
  // below keys on client IP alone, which getClientIp()'s own doc
  // comment already discloses is best-effort (trusts X-Forwarded-For
  // with no trusted-proxy validation) — a spoofed header defeats it
  // entirely. This second check keys on the TARGET email instead, so
  // spamming one victim's inbox with reset emails stays throttled
  // regardless of how many different IPs the request claims.
  await assertEmailTargetRateLimitOk("auth.forgotPassword", body.email, 5, 15 * 60 * 1000);
  await authService.requestPasswordReset(body, { requestId: ctx.requestId, ipAddress: getClientIp(request) });
  return apiSuccess({ message: "If an account exists for that email, a reset link has been sent." });
}

export const POST = withApiRoute("auth.forgotPassword", handleForgotPassword, {
  rateLimit: { limit: 5, windowMs: 15 * 60 * 1000 },
});

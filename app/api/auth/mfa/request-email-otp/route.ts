import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, apiError } from "@/lib/api";
import { assertEmailTargetRateLimitOk } from "@/lib/api/targetRateLimit";
import { authService, mfaService } from "@/lib/services/auth";

/**
 * POST /api/auth/mfa/request-email-otp
 *
 * The email-OTP fallback's own PRE-LOGIN trigger: at this point in the
 * flow the client has already received `{mfaRequired: true}` from
 * /login (a real password was already verified) but has no session yet
 * — so this route can't be `requiredRole`-gated. Re-verifies email +
 * password via authService.verifyCredentialsForChallenge() (never
 * accepts just an email — that would let an attacker spam OTP emails
 * to any account without knowing its password) before triggering
 * mfaService.requestEmailOtp(). Deliberately reports the same generic
 * success regardless of whether the account exists/has MFA enabled/
 * the password matched — the identical anti-enumeration principle
 * authService.login()'s own generic error already applies, since this
 * route sits on the same unauthenticated attack surface.
 */
async function handleRequestEmailOtp(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return apiError([{ field: "root", message: "Email and password are required." }], 400);
  }
  // RC-9 — second rate-limit dimension keyed on the target email, not
  // just client IP — see lib/api/targetRateLimit.ts's own doc comment
  // for the real, live-proven X-Forwarded-For spoofing gap this closes.
  // A correct-password holder (attacker or otherwise) could otherwise
  // flood the real account owner's inbox with OTP codes unthrottled.
  await assertEmailTargetRateLimitOk("auth.mfa.requestEmailOtp", body.email, 5, 15 * 60 * 1000);

  const verified = await authService.verifyCredentialsForChallenge(body.email, body.password);
  if (verified?.mfaEnabled) {
    void mfaService.requestEmailOtp(verified.id);
  }
  return apiSuccess({ message: "If your account has email verification codes enabled, a code has been sent." });
}

export const POST = withApiRoute("auth.mfa.requestEmailOtp", handleRequestEmailOtp, {
  rateLimit: { limit: 5, windowMs: 15 * 60 * 1000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, apiError } from "@/lib/api";
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

  const verified = await authService.verifyCredentialsForChallenge(body.email, body.password);
  if (verified?.mfaEnabled) {
    void mfaService.requestEmailOtp(verified.id);
  }
  return apiSuccess({ message: "If your account has email verification codes enabled, a code has been sent." });
}

export const POST = withApiRoute("auth.mfa.requestEmailOtp", handleRequestEmailOtp, {
  rateLimit: { limit: 5, windowMs: 15 * 60 * 1000 },
});

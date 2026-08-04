import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, apiError } from "@/lib/api";
import { getClientIp } from "@/lib/api/clientIp";
import { setAuthCookies } from "@/lib/api/cookies";
import { oauthService } from "@/lib/services/auth";

/**
 * POST /api/auth/oauth/mfa/verify
 *
 * Body: { pendingToken, mfaCode, provider }. No `requiredRole` — this
 * is, by definition, for a user who doesn't have a session yet (see
 * oauth/mfaPending.ts's own doc comment for why the OAuth callback
 * can't just accept an mfaCode directly the way /api/auth/login does).
 * The pendingToken itself IS the credential proving a real OAuth login
 * already completed for a specific user; this route only has to verify
 * a real MFA code against that same user before issuing session
 * tokens.
 */
async function handleVerify(request: Request, ctx: { requestId: string }): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { pendingToken?: unknown; mfaCode?: unknown; provider?: unknown };
  if (typeof body.pendingToken !== "string" || typeof body.mfaCode !== "string" || typeof body.provider !== "string") {
    return apiError([{ field: "root", message: "pendingToken, mfaCode, and provider are required." }], 400);
  }

  const result = await oauthService.completeMfaChallenge(body.pendingToken, body.mfaCode, body.provider, {
    requestId: ctx.requestId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  if (!result.success) return apiError([{ field: "mfaCode", message: result.error }], 400);

  const response = apiSuccess({ user: result.user, newDevice: result.newDevice });
  setAuthCookies(response, result.tokens);
  return response;
}

export const POST = withApiRoute("auth.oauth.mfa.verify", handleVerify, {
  rateLimit: { limit: 10, windowMs: 15 * 60 * 1000 },
});

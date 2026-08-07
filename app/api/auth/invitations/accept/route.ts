import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, setAuthCookies, ValidationApiError, UnauthorizedApiError } from "@/lib/api";
import { getClientIp } from "@/lib/api/clientIp";
import { isSameOriginRequest } from "@/lib/api/verifySameOrigin";
import { invitationService } from "@/lib/services/onboarding";

/**
 * POST /api/auth/invitations/accept
 *
 * RC-7 — Customer Onboarding & SaaS Activation. The recipient of a
 * team invitation has no session yet (this is how they GET one) — no
 * `requiredRole`, reached the same way `/api/auth/verify-email` and
 * `/api/auth/reset-password` already are: the token itself IS the
 * credential. Same anti-CSRF same-origin check login/register already
 * use, for the identical reason (this sets real auth cookies, before
 * any session exists — SameSite=Lax alone doesn't protect a route with
 * no pre-existing cookie to scope against).
 *
 * Body: { token, name, password }. On success, the new account is
 * auto-signed-in directly into the inviting organization — no separate
 * onboarding wizard for an invited team member (they're joining an
 * ALREADY-onboarded organization, not starting a new one).
 */
async function handleAcceptInvitation(request: Request, ctx: { requestId: string }): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) throw new UnauthorizedApiError([{ field: "root", message: "Invalid request origin." }]);
  const body = (await parseJsonBody(request)) as { token?: unknown; name?: unknown; password?: unknown };
  if (typeof body.token !== "string" || !body.token) {
    throw new ValidationApiError([{ field: "token", message: "An invitation token is required." }]);
  }

  const result = await invitationService.acceptInvitation(body.token, body, {
    requestId: ctx.requestId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  if (!result.success) throw new ValidationApiError(result.errors);

  const response = apiSuccess({ user: result.user }, 201);
  setAuthCookies(response, result.tokens);
  return response;
}

export const POST = withApiRoute("auth.invitations.accept", handleAcceptInvitation, {
  rateLimit: { limit: 10, windowMs: 15 * 60 * 1000 },
});

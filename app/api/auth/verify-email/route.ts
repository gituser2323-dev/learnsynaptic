import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, apiError } from "@/lib/api";
import { authService } from "@/lib/services/auth";

/**
 * POST /api/auth/verify-email
 *
 * Body: { token }. Completes email verification — a POST (not a GET
 * with the token in the URL) so the token never lands in server access
 * logs or a browser's history/referrer header, even though the admin
 * UI page itself is reached via a GET link with `?token=` in the query
 * string (the page reads it client-side and POSTs it here, the same
 * "token in URL for the click, never for the verify" shape a real
 * password-reset link uses too). No requiredRole — a not-yet-logged-in
 * user completing verification right after signup is a real path.
 */
async function handleVerifyEmail(request: Request, ctx: { requestId: string }): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  if (typeof body.token !== "string" || !body.token) {
    return apiError([{ field: "token", message: "A verification token is required." }], 400);
  }
  const result = await authService.verifyEmail(body.token, { requestId: ctx.requestId });
  if (result.status === "verified") return apiSuccess({ status: result.status, message: "Your email address has been verified." });

  const messages: Record<string, string> = {
    invalid: "This verification link is invalid.",
    expired: "This verification link has expired. Request a new one.",
    already_used: "This verification link has already been used.",
  };
  return apiError([{ field: "token", message: messages[result.status] ?? "This verification link is invalid." }], 400);
}

export const POST = withApiRoute("auth.verifyEmail", handleVerifyEmail, {
  rateLimit: { limit: 20, windowMs: 15 * 60 * 1000 },
});

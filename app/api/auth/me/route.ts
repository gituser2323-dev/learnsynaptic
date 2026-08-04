import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { mfaService } from "@/lib/services/auth";

/**
 * GET /api/auth/me
 *
 * Returns the identity of the currently authenticated session — any
 * role satisfies requiredRole: "counsellor" (the lowest tier), so this
 * only ever rejects "not authenticated at all," never "wrong role."
 * middleware.ts already 401s an unauthenticated request to this path
 * before it gets here (see middleware.ts's matcher); requiredRole is
 * kept anyway for defense in depth and to reuse the same
 * ACCESS_FORBIDDEN security-audit path as every other gated route.
 *
 * RC-1 — augments the JWT-claims identity with `mfaEnabled`/
 * `emailVerified` (via mfaService.getStatus(), a real DB read — a
 * token's own role/email/org claims are fixed at issuance, but those
 * two fields can change mid-session and the Security Settings screen
 * needs the CURRENT value, not what was true at login time). This
 * lookup is deliberately best-effort: a request whose JWT verifies but
 * whose subject has no backing User row (e2e/tests/helpers.ts mints
 * exactly this — a signed token for a synthetic id with no seeded user,
 * to avoid needing a real backing record for page-level smoke checks)
 * still gets a normal 200 with just the claims, not a 401 — the token
 * itself, verified by middleware.ts before this handler ever runs, is
 * what "authenticated" means here, same as before this field existed.
 */
async function handleMe(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const status = await mfaService.getStatus(ctx.authContext.userId);
  return apiSuccess({
    user: {
      id: ctx.authContext.userId,
      email: ctx.authContext.email,
      role: ctx.authContext.role,
      ...(status ? { name: status.name, emailVerified: status.emailVerified, mfaEnabled: status.mfaEnabled } : {}),
    },
  });
}

export const GET = withApiRoute("auth.me", handleMe, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

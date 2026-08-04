import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { sessionService } from "@/lib/services/auth";

/**
 * DELETE /api/auth/sessions/[id]
 *
 * "Log out this device" — revokes exactly one of the CALLER'S OWN
 * sessions. sessionService.revokeSession() itself verifies ownership
 * (the session must belong to the requesting user) before revoking
 * anything, the real check that makes it safe to accept an arbitrary
 * `id` from the URL — a 404, not a 403, for someone else's session id,
 * so this route never confirms/denies that a given id even exists for
 * another account (the same "cross-tenant id behaves like not-found"
 * convention this app's own tenant isolation already established, one
 * level down from organization to individual session).
 */
async function handleRevokeSession(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const { id } = ctx.params;
  const result = await sessionService.revokeSession(ctx.authContext.userId, id, { requestId: ctx.requestId });
  if (!result.success) throw new NotFoundApiError("Session", id);
  return apiSuccess({});
}

export const DELETE = withApiRoute("auth.sessions.revoke", handleRevokeSession, {
  requiredRole: "counsellor",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

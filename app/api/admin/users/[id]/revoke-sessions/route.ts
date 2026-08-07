import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getUserRepository } from "@/lib/db";
import { sessionService } from "@/lib/services/auth";
import { getTenantContext } from "@/lib/tenancy/context";

/**
 * POST /api/admin/users/[id]/revoke-sessions
 *
 * RC-5 — Backup, Restore & Disaster Recovery: the real, load-bearing
 * capability the "compromised tenant admin account" incident-response
 * procedure (DR_RUNBOOK.md §12) depends on. Force-ends every active
 * session (all refresh tokens) for the target user — no exception,
 * unlike the self-service `POST /api/auth/sessions/revoke-others`
 * (which always keeps the caller's own current session).
 *
 * ⚠️ Manual tenant check required: `User` deliberately does NOT carry
 * `tenantScopePlugin` (same as RefreshToken/Organization/ScheduledJob
 * — see tenantScopePlugin.ts's own doc comment), so
 * `getUserRepository().findById()` is NOT automatically org-scoped.
 * Without the explicit `organizationId` comparison below, an admin in
 * Organization A could revoke sessions for a user in Organization B —
 * exactly the cross-tenant vulnerability class this mission repeatedly
 * warns against. A cross-tenant target resolves as 404, same
 * convention every tenant-scoped entity in this app already uses.
 *
 * ⚠️ requiredRole: "admin" — ending someone else's session is at least
 * as sensitive as any other admin-only bulk/security action in this app.
 */
async function handleRevokeSessions(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id: targetUserId } = ctx.params;
  const organizationId = getTenantContext()?.organizationId;
  const actorId = ctx.authContext.userId;

  const userRepository = await getUserRepository();
  const targetUser = await userRepository.findById(targetUserId);
  if (!targetUser || targetUser.organizationId !== organizationId) {
    throw new NotFoundApiError("User", targetUserId);
  }
  if (targetUserId === actorId) {
    throw new ForbiddenApiError("Use /api/auth/sessions/revoke-others to manage your own sessions.");
  }

  await sessionService.adminRevokeAllSessions(targetUserId, { actorId, requestId: ctx.requestId });
  return apiSuccess({ revoked: true });
}

export const POST = withApiRoute("admin.users.revokeSessions", handleRevokeSessions, {
  requiredRole: "admin",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { platformOrganizationService } from "@/lib/services/organizations";

/**
 * POST /api/admin/platform/organizations/[id]/reactivate
 *
 * RC-6 — the reverse of suspend. Idempotent (reactivating an
 * already-active org is a safe no-op).
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleReactivate(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const organization = await platformOrganizationService.reactivateOrganization(id, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  return apiSuccess({ organization });
}

export const POST = withApiRoute("platform.organizations.reactivate", handleReactivate, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

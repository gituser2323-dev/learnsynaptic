import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { mfaService } from "@/lib/services/auth";

/**
 * DELETE /api/auth/mfa/trusted-devices/[id]
 *
 * "Forget this device" — revokes exactly one of the CALLER'S OWN
 * trusted-device grants. mfaService.revokeTrustedDevice() verifies
 * ownership before revoking anything; a 404 (not 403) for someone
 * else's device id, mirroring /api/auth/sessions/[id]'s own
 * "cross-tenant id behaves like not-found" convention one level down
 * from session to individual trusted device.
 */
async function handleRevokeTrustedDevice(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const { id } = ctx.params;
  const result = await mfaService.revokeTrustedDevice(ctx.authContext.userId, id);
  if (!result.success) throw new NotFoundApiError("Trusted device", id);
  return apiSuccess({});
}

export const DELETE = withApiRoute("auth.mfa.trustedDevices.revoke", handleRevokeTrustedDevice, {
  requiredRole: "counsellor",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

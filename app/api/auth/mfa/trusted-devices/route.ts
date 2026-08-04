import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { mfaService } from "@/lib/services/auth";

/**
 * GET /api/auth/mfa/trusted-devices
 *
 * Lists the caller's own "skip MFA for 30 days" grants — the Security
 * Settings panel's own data source for "devices you've trusted."
 */
async function handleListTrustedDevices(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();
  const devices = await mfaService.listTrustedDevices(ctx.authContext.userId);
  return apiSuccess({
    devices: devices.map((d) => ({
      id: d.id,
      deviceName: d.deviceName,
      createdAt: d.createdAt,
      lastUsedAt: d.lastUsedAt,
      expiresAt: d.expiresAt,
    })),
  });
}

export const GET = withApiRoute("auth.mfa.trustedDevices.list", handleListTrustedDevices, {
  requiredRole: "counsellor",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

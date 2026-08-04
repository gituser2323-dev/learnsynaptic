import QRCode from "qrcode";
import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { mfaService } from "@/lib/services/auth";

/**
 * POST /api/auth/mfa/setup
 *
 * Step 1 of enabling TOTP MFA: generates a fresh secret (stored
 * encrypted, but MFA stays OFF until /mfa/confirm verifies a real
 * code) and returns a QR code the user scans with any standard
 * authenticator app (Google Authenticator, Authy, 1Password, etc.).
 * `qrcode` (the npm package) renders the real `otpauth://` URI
 * mfaService.beginSetup() builds into a PNG data URL — no external
 * service call, no QR image ever leaves this server unencoded.
 * `secret` is also returned in plain base32 for manual entry, the
 * standard fallback every authenticator app itself offers when a
 * camera isn't available.
 */
async function handleMfaSetup(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId || !ctx.authContext.email) throw new UnauthorizedApiError();
  const { secret, otpauthUri } = await mfaService.beginSetup(ctx.authContext.userId, ctx.authContext.email);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);
  return apiSuccess({ secret, qrCodeDataUrl });
}

export const POST = withApiRoute("auth.mfa.setup", handleMfaSetup, {
  requiredRole: "counsellor",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

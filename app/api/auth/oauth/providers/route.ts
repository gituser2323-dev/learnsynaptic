import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { oauthService } from "@/lib/services/auth";

/**
 * GET /api/auth/oauth/providers
 *
 * Public (no requiredRole) — the login page needs this before anyone is
 * authenticated, to decide which "Sign in with X" buttons to render.
 * "Do NOT hardcode providers": this is genuinely the only place a
 * client learns which vendors are configured (see oauthService.
 * listProviders()).
 */
async function handleListProviders(): Promise<NextResponse> {
  return apiSuccess({ providers: oauthService.listProviders() });
}

export const GET = withApiRoute("auth.oauth.providers", handleListProviders, {
  rateLimit: { limit: 60, windowMs: 60_000 },
});

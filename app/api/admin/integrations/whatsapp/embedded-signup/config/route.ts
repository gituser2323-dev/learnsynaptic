import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getTenantContext } from "@/lib/tenancy/context";
import { entitlementService } from "@/lib/services/billing";
import { isEmbeddedSignupConfigured, META_EMBEDDED_SIGNUP_CONFIG } from "@/config/whatsapp";

/**
 * GET /api/admin/integrations/whatsapp/embedded-signup/config
 *
 * Business OS Phase 8, Module 8.5 — the one safe, client-facing
 * platform config an admin's browser needs to render the Facebook JS
 * SDK's Embedded Signup button: the Meta App ID and Embedded Signup
 * Configuration ID. Both are genuinely safe to serve here (Meta's own
 * design requires the App ID in every client-side SDK init call, and
 * the Config ID is a public flow selector, never a secret) — the App
 * Secret this deployment's server-side code exchange uses is never
 * returned by any route.
 *
 * `entitled` is a real, server-checked fact (never inferred client-side
 * from plan name) — the UI shows an upgrade prompt instead of the
 * signup button when false, but the actual gate that matters is the
 * complete route's own `requiredCapability`, which rejects a save
 * regardless of what this response claimed.
 */
async function handleGetConfig(_request: Request, _ctx: ApiRouteContext): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const entitled = await entitlementService.hasCapability(organizationId, "whatsapp_embedded_signup");
  const configured = isEmbeddedSignupConfigured();

  return apiSuccess({
    configured,
    entitled,
    appId: configured && entitled ? META_EMBEDDED_SIGNUP_CONFIG.appId : undefined,
    configId: configured && entitled ? META_EMBEDDED_SIGNUP_CONFIG.configId : undefined,
  });
}

export const GET = withApiRoute("admin.integrations.whatsapp.embeddedSignup.config", handleGetConfig, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

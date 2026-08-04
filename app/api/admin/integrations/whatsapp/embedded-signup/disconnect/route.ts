import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getTenantContext } from "@/lib/tenancy/context";
import { embeddedSignupService } from "@/lib/services/whatsapp";
import { throwForEmbeddedSignupError } from "../_lib/errorMapping";

/**
 * POST /api/admin/integrations/whatsapp/embedded-signup/disconnect
 *
 * Business OS Phase 8, Module 8.5 — a dedicated route rather than the
 * generic `/api/admin/integrations/[providerId]/disconnect`: that one
 * explicitly rejects builtIn providers (WhatsApp's real connect
 * lifecycle was env-config-only before this module) — see
 * `integrationService.disconnect()`'s own doc comment. This route
 * calls `embeddedSignupService.disconnect()`, which goes through
 * `clearTenantCredentials()` instead, the one write path Module 8.2
 * already made explicitly ALLOWED for builtIn providers.
 *
 * Safe by construction: never deletes Conversations/Messages/
 * Activities/audit history, only clears the stored credential and
 * releases this phone number's routing entry — see that service's own
 * doc comment for the full disconnect contract.
 */
async function handleDisconnect(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  try {
    await embeddedSignupService.disconnect(organizationId, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
    const summary = await embeddedSignupService.getConnectionSummary(organizationId);
    return apiSuccess({ connection: summary });
  } catch (error) {
    throwForEmbeddedSignupError(error);
  }
}

export const POST = withApiRoute("admin.integrations.whatsapp.embeddedSignup.disconnect", handleDisconnect, {
  requiredRole: "admin",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

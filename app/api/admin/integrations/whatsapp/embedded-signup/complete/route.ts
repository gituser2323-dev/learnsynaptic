import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getTenantContext } from "@/lib/tenancy/context";
import { embeddedSignupService } from "@/lib/services/whatsapp";
import { throwForEmbeddedSignupError } from "../_lib/errorMapping";

/**
 * POST /api/admin/integrations/whatsapp/embedded-signup/complete
 *
 * Business OS Phase 8, Module 8.5 — where the Embedded Signup popup's
 * client-side result (the authorization `code`, plus the `wabaId`/
 * `phoneNumberId` its own session-info postMessage reported) becomes a
 * real, tenant-isolated connection. `organizationId` is deliberately
 * NEVER read from the request body — it comes only from this route's
 * own authenticated tenant context (`getTenantContext()`, established
 * by `withApiRoute` from the session cookie before this handler ever
 * runs), the mission's own explicit "never trust organizationId
 * supplied arbitrarily by the browser" requirement satisfied by
 * construction: there is no code path here that could even read an
 * organizationId from the client.
 *
 * `requiredCapability: "whatsapp_embedded_signup"` gates this at the
 * route level, on top of (not instead of) `embeddedSignupService
 * .connect()`'s own internal `entitlementService.assertCapability`
 * call — the same belt-and-suspenders pattern Module 8.3 already
 * established for `whatsapp-campaigns`.
 */
async function handleComplete(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const body = (await parseJsonBody(request)) as { code?: unknown; wabaId?: unknown; phoneNumberId?: unknown };
  if (typeof body.code !== "string" || !body.code.trim()) {
    throw new ValidationApiError([{ field: "code", message: "Missing authorization code from the WhatsApp signup popup." }]);
  }
  if (body.wabaId !== undefined && typeof body.wabaId !== "string") {
    throw new ValidationApiError([{ field: "wabaId", message: "wabaId must be a string." }]);
  }
  if (body.phoneNumberId !== undefined && typeof body.phoneNumberId !== "string") {
    throw new ValidationApiError([{ field: "phoneNumberId", message: "phoneNumberId must be a string." }]);
  }

  try {
    const summary = await embeddedSignupService.connect(
      organizationId,
      { code: body.code, wabaId: body.wabaId as string | undefined, phoneNumberId: body.phoneNumberId as string | undefined },
      { actorId: ctx.authContext.userId, requestId: ctx.requestId },
    );
    return apiSuccess({ connection: summary });
  } catch (error) {
    throwForEmbeddedSignupError(error);
  }
}

export const POST = withApiRoute("admin.integrations.whatsapp.embeddedSignup.complete", handleComplete, {
  requiredRole: "admin",
  requiredCapability: "whatsapp_embedded_signup",
  rateLimit: { limit: 10, windowMs: 60_000 },
});

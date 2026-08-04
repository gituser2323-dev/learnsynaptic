import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";
import { throwForIntegrationError } from "../../_lib/errorMapping";

/**
 * PUT /api/admin/integrations/[providerId]/credentials
 * DELETE /api/admin/integrations/[providerId]/credentials
 *
 * Business OS Phase 8, Module 8.2 — the write path for a tenant's own
 * per-organization provider credentials (WhatsApp/Email/AI's env
 * fallback, plus any other provider's generic key-value config),
 * backing setTenantCredentials()/clearTenantCredentials(). Deliberately
 * a SEPARATE route from PUT .../config above, not a merged body shape:
 * `config` is validated to actively REJECT credential-shaped keys
 * (validation.ts's CREDENTIAL_LIKE_KEY_PATTERN), so a real secret
 * belongs on this route, never that one. Unlike connect()/disconnect()/
 * PUT config above (all rejected for builtIn WhatsApp/Email/AI — see
 * integrationService's own doc comment), this route is explicitly
 * ALLOWED for builtIn providers too: overriding a builtIn provider's
 * env-configured credential with this organization's own is the whole
 * point of Module 8.2.
 *
 * The response body's `credentialRef.encryptedValues` (when present)
 * is always masked ("••••••••" per key) by integrationService's own
 * maskCredentialRef() — the actual ciphertext, and certainly never the
 * plaintext, is not returned here or anywhere else in this API.
 *
 * ⚠️ requiredRole: "admin" — the same threshold every other integration
 * lifecycle route in this module already enforces; a Counsellor or
 * Manager has no credential-management capability (see this module's
 * own CHANGELOG entry for the full RBAC verification).
 */
async function handleSetCredentials(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  const body = (await parseJsonBody(request)) as { values?: unknown };

  if (typeof body.values !== "object" || body.values === null || Array.isArray(body.values)) {
    return throwForIntegrationError({ code: "validation", message: "Invalid credentials.", errors: [{ field: "values", message: "values must be an object." }] }, providerId);
  }
  const entries = Object.entries(body.values as Record<string, unknown>);
  if (entries.some(([, v]) => typeof v !== "string")) {
    return throwForIntegrationError(
      { code: "validation", message: "Invalid credentials.", errors: [{ field: "values", message: "Every credential value must be a string." }] },
      providerId,
    );
  }

  const result = await integrationService.setTenantCredentials(providerId, body.values as Record<string, string>, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  if (!result.success) throwForIntegrationError(result.error, providerId);
  return apiSuccess({ integration: result.data });
}

async function handleClearCredentials(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  const result = await integrationService.clearTenantCredentials(providerId, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!result.success) throwForIntegrationError(result.error, providerId);
  return apiSuccess({ integration: result.data });
}

export const PUT = withApiRoute("admin.integrations.setCredentials", handleSetCredentials, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const DELETE = withApiRoute("admin.integrations.clearCredentials", handleClearCredentials, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";
import { throwForIntegrationError } from "../../_lib/errorMapping";

/** Connect's own body is entirely optional (an admin might just click
 *  "Connect" with no config yet) — unlike every other route in this
 *  app, an empty request body here is a normal request, not a
 *  malformed one, so this doesn't use the shared parseJsonBody (which
 *  throws ValidationApiError on anything that isn't valid JSON,
 *  including an empty body). */
async function parseOptionalJsonBody(request: Request): Promise<{ config?: unknown; credentialRef?: unknown }> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as { config?: unknown; credentialRef?: unknown };
  } catch {
    return {};
  }
}

/**
 * POST /api/admin/integrations/[providerId]/connect
 *
 * Integrations Hub (Phase 6), Module 6.1 — Connect (and Reconnect,
 * same request shape: calling this again on an already-connected
 * provider just refreshes its config/credentialRef). Rejected for any
 * builtIn provider (WhatsApp/Email/AI) — those are connected via
 * environment configuration, not this route; see integrationService's
 * own doc comment for why a second connect path here would duplicate
 * logic that already exists.
 *
 * Body: `{ config?: object, credentialRef?: {type, ...} }` — `config`
 * is validated server-side to reject any key that looks credential-
 * shaped (see validation.ts); no secret ever reaches this route's
 * response or any log line.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleConnect(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  const body = await parseOptionalJsonBody(request);

  const result = await integrationService.connect(
    providerId,
    { config: body.config, credentialRef: body.credentialRef },
    { actorId: ctx.authContext.userId, requestId: ctx.requestId },
  );

  if (!result.success) throwForIntegrationError(result.error, providerId);
  return apiSuccess({ integration: result.data }, 201);
}

export const POST = withApiRoute("admin.integrations.connect", handleConnect, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { isSameOriginRequest } from "@/lib/api/verifySameOrigin";
import { registrationService } from "@/lib/services/registrations";

/**
 * POST /api/registrations
 *
 * Third resource on the Module 4 API architecture — creates a
 * Registration, and atomically increments its Campaign's
 * registrationCount when campaignId is provided (see
 * registrationService.createRegistration(), the first real caller of
 * lib/db/transaction.ts's runInTransaction()).
 *
 * Same-origin checked, deliberately not auth-gated (Business OS Phase 0
 * hardening) — this route backs a real public registration flow (a site
 * visitor has no account), so blanket authentication isn't the right
 * fix; a mismatched-Origin request is rejected instead. /api/campaigns'
 * equivalent gap was closed differently (requiredRole: "admin") because
 * that route, unlike this one, has zero real public callers — see that
 * route's own doc comment. leadId/campaignId must still resolve to real
 * records or the request is rejected with a 400 regardless.
 *
 * DTO validation happens inside registrationService.createRegistration()
 * (field-level in validation.ts, existence checks against real
 * Lead/Campaign records in the service itself) — parseJsonBody() here
 * only does safe JSON parsing, same pattern as /api/leads and
 * /api/campaigns.
 */
async function handleCreateRegistration(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    throw new ForbiddenApiError("This endpoint only accepts requests from the LearnSynaptic website.");
  }

  const body = await parseJsonBody(request);
  const result = await registrationService.createRegistration(body, { requestId: ctx.requestId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  // 201 for a genuinely new registration, 200 for a recognized repeat —
  // same convention as /api/leads.
  return apiSuccess(
    { registration: result.registration, duplicate: result.duplicate },
    result.duplicate ? 200 : 201,
  );
}

export const POST = withApiRoute("registrations.create", handleCreateRegistration, {
  rateLimit: { limit: 10, windowMs: 60_000 },
});

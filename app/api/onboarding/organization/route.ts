import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { onboardingService } from "@/lib/services/onboarding";

/**
 * POST /api/onboarding/organization
 *
 * RC-7 — Customer Onboarding & SaaS Activation. The ORGANIZATION step:
 * the one route a genuinely orgless, mid-onboarding session is allowed
 * to reach (`routeName` starts with `onboarding.` — see
 * withApiRoute.ts's own "RC-7" doc comment for why this is the ONLY
 * kind of route exempt from its pre-organization gate, alongside
 * `auth.*`). No `requiredRole` — a user with no organization yet has
 * no meaningful tenant role to check against.
 *
 * Body: { name, industry?, teamSize?, website?, country?, timezone? }.
 * Real preconditions are enforced in onboardingService itself (account
 * must exist, email must be verified) — this route is a thin HTTP
 * adapter, same shape as every other route in this app.
 *
 * On success, the calling session's own access token still carries NO
 * `organizationId` claim (it was minted before this organization
 * existed). This route deliberately does NOT try to re-mint it
 * inline: the refresh-token cookie is scoped to `path: /api/auth`
 * (config/auth.ts's own `AUTH_REFRESH_COOKIE_PATH`), so it's never
 * even sent by the browser on a request to this path — reading it here
 * would silently fail. The wizard's own client calls the existing,
 * already-correctly-scoped `POST /api/auth/refresh` immediately after
 * a successful response from this route instead, the same real
 * token-issuance path a normal refresh already uses, rather than this
 * route inventing a second one.
 */
async function handleCreateOrganization(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.userId) throw new UnauthorizedApiError();

  const body = await parseJsonBody(request);
  const result = await onboardingService.createOrganizationForUser(ctx.authContext.userId, body, {
    requestId: ctx.requestId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ organization: result.organization, alreadyExisted: result.alreadyExisted }, result.alreadyExisted ? 200 : 201);
}

export const POST = withApiRoute("onboarding.organization.create", handleCreateOrganization, {
  rateLimit: { limit: 10, windowMs: 15 * 60 * 1000 },
});

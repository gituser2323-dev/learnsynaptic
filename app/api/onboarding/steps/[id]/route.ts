import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { onboardingService } from "@/lib/services/onboarding";
import type { OnboardingStepId, OnboardingStepStatus } from "@/lib/services/organizations";

const VALID_STEPS: OnboardingStepId[] = ["plan", "team", "whatsapp", "email", "ai", "calendar", "crm", "import"];
const VALID_STATUSES: OnboardingStepStatus[] = ["completed", "skipped"];

/**
 * POST /api/onboarding/steps/[id]
 *
 * RC-7 — Customer Onboarding & SaaS Activation. The one generic
 * progress-tracking route every optional wizard step calls — see
 * onboardingService.markStepStatus()'s own doc comment for why this
 * is deliberately separate from each feature's own real route (plan
 * assignment, WhatsApp connection, lead import) rather than teaching
 * eight different routes about onboarding bookkeeping.
 *
 * Body: { status: "completed" | "skipped" }. `requiredRole: "admin"`
 * — the tenant Admin who created the organization is who's expected
 * to be driving the wizard; this is an organization-wide progress
 * record, not a personal one.
 */
async function handleMarkStep(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.organizationId) throw new UnauthorizedApiError();

  const step = ctx.params.id as OnboardingStepId;
  if (!VALID_STEPS.includes(step)) {
    throw new ValidationApiError([{ field: "id", message: `Step must be one of: ${VALID_STEPS.join(", ")}.` }]);
  }

  const body = (await parseJsonBody(request)) as { status?: unknown };
  if (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as OnboardingStepStatus)) {
    throw new ValidationApiError([{ field: "status", message: `Status must be one of: ${VALID_STATUSES.join(", ")}.` }]);
  }

  const organization = await onboardingService.markStepStatus(ctx.authContext.organizationId, step, body.status as OnboardingStepStatus, {
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });

  return apiSuccess({ organization });
}

export const POST = withApiRoute("onboarding.steps.update", handleMarkStep, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

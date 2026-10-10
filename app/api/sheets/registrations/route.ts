import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { isSameOriginRequest } from "@/lib/api/verifySameOrigin";
import { isValidIndianMobile, normalizeIndianMobile } from "@/lib/ai-bootcamp/validation";
import { appendRegistrationToSheet } from "@/lib/integrations/googleSheet";

/**
 * POST /api/sheets/registrations
 *
 * Mirrors a landing-page registration into Google Sheets. Same posture as
 * /api/leads: unauthenticated (visitors have no account), same-origin only,
 * rate-limited. The CRM write in /api/leads stays the source of truth — this
 * is a convenience copy for the team.
 */
async function handleSheetRegistration(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    throw new ForbiddenApiError("This endpoint only accepts requests from the LearnSynaptic website.");
  }

  const body = (await parseJsonBody(request)) as Record<string, unknown>;
  const phone = typeof body.phone === "string" ? body.phone : "";
  if (!isValidIndianMobile(phone)) {
    throw new ValidationApiError([{ field: "phone", message: "Enter a valid Indian mobile number." }]);
  }

  const clip = (v: unknown, max: number, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;

  const result = await appendRegistrationToSheet({
    name: clip(body.name, 120, "Not provided"),
    phone: normalizeIndianMobile(phone),
    program: clip(body.program, 120, "Unknown"),
    source: clip(body.source, 80, "unknown"),
  });

  return apiSuccess(result);
}

export const POST = withApiRoute("sheets.registrations.create", async (request: Request, _ctx: ApiRouteContext) => handleSheetRegistration(request), {
  rateLimit: { limit: 10, windowMs: 60_000 },
});

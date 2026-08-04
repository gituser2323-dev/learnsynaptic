import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { isSameOriginRequest } from "@/lib/api/verifySameOrigin";
import { leadService } from "@/lib/services/leads";

/**
 * POST /api/leads
 *
 * The first backend endpoint in this app — see ARCHITECTURE.md Finding 1:
 * every existing form currently calls EmailJS directly from the browser,
 * with no persistence, dedup, or admin visibility at all. Now wired into
 * one form (components/lead-modal/LeadForm.tsx), alongside — not instead
 * of — its existing EmailJS call.
 *
 * Runs on the Node.js runtime (the default for route handlers) rather
 * than Edge — required, since the MongoDB path depends on Mongoose.
 *
 * Rate-limited at 10 requests/minute per IP — generous enough for a
 * legitimate visitor resubmitting a typo'd form, tight enough to blunt
 * naive scripted abuse. See lib/api/rateLimit/inMemory.ts for the known
 * per-instance limitation of the current (in-memory) limiter.
 *
 * Same-origin checked (Business OS Phase 0 hardening) — this route stays
 * intentionally unauthenticated (a site visitor filling out a form has
 * no account), but a request whose Origin doesn't match the host it was
 * sent to is rejected. See lib/api/verifySameOrigin.ts.
 *
 * DTO validation happens inside leadService.registerLead() (built in the
 * Lead Registration System module) rather than being duplicated here —
 * parseJsonBody() below only needs to do safe JSON parsing for this
 * route. A future route without its own service-layer validator would
 * pass one into parseJsonBody() directly (see lib/api/dto.ts).
 */
async function handleCreateLead(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    throw new ForbiddenApiError("This endpoint only accepts requests from the LearnSynaptic website.");
  }

  const body = await parseJsonBody(request);
  const result = await leadService.registerLead(body, { requestId: ctx.requestId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  // 201 for a genuinely new lead, 200 for a recognized duplicate — lets
  // a client distinguish "created" from "we already had you" without
  // inspecting the body.
  return apiSuccess({ lead: result.lead, duplicate: result.duplicate }, result.duplicate ? 200 : 201);
}

export const POST = withApiRoute("leads.create", handleCreateLead, {
  rateLimit: { limit: 10, windowMs: 60_000 },
});

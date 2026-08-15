import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError, ForbiddenApiError, ConflictApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { isSameOriginRequest } from "@/lib/api/verifySameOrigin";
import { publicBookingService } from "@/lib/services/crm/appointments";

/**
 * GET /api/booking/[slug], POST /api/booking/[slug]
 *
 * Appointment Booking — the public, unauthenticated entry point a
 * tenant's own hosted booking page (app/book/[slug]/page.tsx) reads
 * config from (GET) and submits a booking to (POST). Mirrors
 * app/api/lead-capture/[slug]/route.ts's own shape and reasoning
 * exactly, including the same real reason the public page fetches this
 * GET endpoint over HTTP rather than a Server Component calling
 * publicBookingService directly (Next.js's production build separates
 * Route Handler and Server Component module graphs, so the in-memory
 * repository's own module-level singleton isn't guaranteed to be the
 * same instance across them — see that file's own doc comment).
 *
 * POST mirrors POST /api/lead-capture/[slug]'s own shape closely
 * (same-origin check, no requiredRole, DTO validation delegated to the
 * service layer) — the one difference is this route also resolves and
 * re-verifies WHICH exact slot the untrusted `slug` + `startAt` resolve
 * to before the underlying leadService.registerLead()/appointment
 * repository ever run. See publicBookingService.ts for that resolution
 * + the existing-CRM hand-off; this route itself is a thin HTTP adapter
 * over it.
 *
 * Same-origin, not a per-tenant CORS allowlist — the booking page itself
 * is served by this app (app/book/[slug]/page.tsx), so a legitimate
 * submission is always same-origin regardless of which tenant's
 * AppointmentType it targets. Runs on the Node.js runtime (this route's
 * default), required since this path depends on Mongoose.
 */
async function handleGetConfig(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { slug } = ctx.params;
  const config = await publicBookingService.getPublicConfig(slug);
  if (!config) throw new NotFoundApiError("AppointmentType", slug);
  return apiSuccess({ appointmentType: config });
}

async function handleBook(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    throw new ForbiddenApiError("This endpoint only accepts requests from this site.");
  }

  const { slug } = ctx.params;
  const body = await parseJsonBody(request);
  const result = await publicBookingService.book(slug, body);

  if (!result.success) {
    if (result.status === 404) throw new NotFoundApiError("AppointmentType", slug);
    if (result.status === 409) throw new ConflictApiError(result.message);
    throw new ValidationApiError(result.errors ?? [{ field: "root", message: result.message }]);
  }

  return apiSuccess({ name: result.name, startAt: result.startAt, endAt: result.endAt, timezone: result.timezone }, result.duplicate ? 200 : 201);
}

export const GET = withApiRoute("booking.getConfig", handleGetConfig, {
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("booking.book", handleBook, {
  rateLimit: { limit: 10, windowMs: 60_000 },
});

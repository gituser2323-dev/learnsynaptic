import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { isSameOriginRequest } from "@/lib/api/verifySameOrigin";
import { publicSubmissionService } from "@/lib/services/crm/leadCaptureForms";

/**
 * GET /api/lead-capture/[slug], POST /api/lead-capture/[slug]
 *
 * Lead Capture — the public, unauthenticated entry point a tenant's own
 * hosted form page (app/forms/[slug]/page.tsx) reads config from (GET)
 * and submits to (POST). The page fetches this GET endpoint over real
 * HTTP rather than calling publicSubmissionService directly from a
 * Server Component — deliberate, not incidental: Next.js's production
 * build bundles Route Handlers and Server Components into separate
 * module graphs, so a module-level singleton (the in-memory repository's
 * own store, used whenever MongoDB isn't configured — see
 * lib/db/registry.ts) is NOT guaranteed to be the same instance across
 * them. Routing every read through this one real endpoint, the same way
 * every other data-driven page in this app already fetches via
 * components/admin/apiClient.ts, sidesteps that entirely — found via a
 * real e2e failure during this module's own build, not a theoretical
 * concern.
 *
 * POST mirrors app/api/leads/route.ts's own shape closely (same-origin
 * check, no requiredRole, DTO validation delegated to the service
 * layer) — the one difference is this route also resolves WHICH
 * organization the submission belongs to, from the untrusted `slug`
 * route param, before the underlying leadService.registerLead() ever
 * runs. See publicSubmissionService.ts for that resolution + the
 * existing-CRM hand-off; this route itself is a thin HTTP adapter over it.
 *
 * Same-origin, not a per-tenant CORS allowlist: the form itself is
 * served by this app (app/forms/[slug]/page.tsx), so a legitimate
 * submission is always same-origin regardless of which tenant's form it
 * is — see the approved plan's own "hosted page, not an embed widget"
 * decision for why. Runs on the Node.js runtime (this route's default),
 * required since the Lead Capture path depends on Mongoose.
 */
async function handleGetConfig(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { slug } = ctx.params;
  const config = await publicSubmissionService.getPublicFormConfig(slug);
  if (!config) throw new NotFoundApiError("Form", slug);
  return apiSuccess({ form: config });
}

async function handleSubmit(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    throw new ForbiddenApiError("This endpoint only accepts requests from this site.");
  }

  const { slug } = ctx.params;
  const body = await parseJsonBody(request);
  const result = await publicSubmissionService.submit(slug, body);

  if (!result.success) {
    if (result.status === 404) throw new NotFoundApiError("Form", slug);
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ duplicate: result.duplicate, message: result.successMessage }, result.duplicate ? 200 : 201);
}

export const GET = withApiRoute("leadCapture.getConfig", handleGetConfig, {
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("leadCapture.submit", handleSubmit, {
  rateLimit: { limit: 10, windowMs: 60_000 },
});

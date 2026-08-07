import { NextResponse } from "next/server";
import { ApiReference } from "@scalar/nextjs-api-reference";
import { withApiRoute } from "@/lib/api";

/**
 * GET /api/docs/reference
 *
 * RC-8 — Documentation, API Documentation & Operational Knowledge
 * Base. A real, interactive developer-facing API documentation UI
 * (mission's own §10), rendered by Scalar from the real OpenAPI spec
 * served at /api/docs/openapi.json (same-origin fetch, authenticated
 * by the same session cookie — no separate credential needed).
 *
 * `requiredRole: "admin"` for the same reason /api/docs/openapi.json
 * is gated — see that route's own doc comment. Never public.
 *
 * Scalar's client-side app itself loads from a CDN script tag
 * (`@scalar/client-side-rendering`'s own design — it is not an inline
 * bundle Next.js can serve from 'self'), pinned to the exact
 * @scalar/api-reference version installed in package.json rather than
 * an unversioned "latest" URL — see next.config.ts's own
 * API_DOCS_CSP_DIRECTIVES doc comment for the narrowly-scoped CSP
 * relaxation this one route needs and why it doesn't affect any other
 * route. Keep this version string in sync with package.json's
 * `@scalar/api-reference` entry when bumping either package.
 */
const SCALAR_API_REFERENCE_PINNED_VERSION = "1.64.0";

const renderReference = ApiReference({
  url: "/api/docs/openapi.json",
  cdn: `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_API_REFERENCE_PINNED_VERSION}`,
  pageTitle: "LearnSynaptic Business OS — API Reference",
  theme: "purple",
});

async function handleGetReference(): Promise<NextResponse> {
  const upstream = await renderReference();
  return new NextResponse(upstream.body, { status: upstream.status, headers: upstream.headers });
}

export const GET = withApiRoute("docs.reference_ui", handleGetReference, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});

/**
 * Same-origin check for the two public write routes that must stay
 * reachable by anonymous visitors (POST /api/leads, POST /api/
 * registrations back real marketing-site forms — no login) but should
 * reject cross-site scripted abuse and CSRF-style cross-origin form
 * posts. Not a general auth mechanism, and not applied to every route:
 * these two specifically were flagged as the one remaining "is data
 * actually safe" gap once every other write path was gated by real
 * authentication (see PRODUCTION_SCORE.md's own High-priority list).
 *
 * Compares the request's Origin header against its own Host header —
 * the standard OWASP CSRF-mitigation technique — rather than against
 * config/site.ts's SITE_URL constant. SITE_URL is a NEXT_PUBLIC_
 * build-time default (learnsynaptic.com) that's never overridden in
 * local dev, so comparing against it directly would reject every
 * legitimate localhost form submission during development; comparing
 * against the request's own Host is correct in every environment
 * (local dev, preview deploys, production) without an env var.
 *
 * Every legitimate caller of these routes is this site's own React
 * client code, calling via fetch() — which always sends an Origin
 * header in every modern browser. A request with no Origin header, or
 * one whose origin doesn't match the host it was sent to, is either a
 * non-browser scripted caller or a cross-site form post; neither is a
 * legitimate caller of these two routes today. Fails closed (rejects)
 * rather than fails open on a missing header, since these routes are
 * never called any other way.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

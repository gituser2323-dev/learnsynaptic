/**
 * The one place the production origin is defined — used by
 * app/robots.ts, app/sitemap.ts, and app/layout.tsx's metadataBase.
 * Previously this URL was hardcoded independently wherever it was
 * needed (e.g. app/bootcamp/page.tsx's JSON-LD `sameAs`); new call
 * sites should import this instead of repeating the literal string.
 *
 * NEXT_PUBLIC_ (not server-only) since metadataBase and JSON-LD are
 * rendered into the HTML response, not a secret.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://learnsynaptic.com";

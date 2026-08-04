/**
 * Single source of truth for scheduled-job authentication. Server-only —
 * never NEXT_PUBLIC_* — this secret authenticates Vercel Cron's calls
 * into app/api/cron/*, which sit outside middleware.ts's JWT-cookie
 * matcher (a cron invocation has no browser session to carry a cookie).
 *
 * Unlike JWT_ACCESS_TOKEN_SECRET (config/auth.ts), there is no safe
 * per-process fallback here: a cron endpoint with no real secret
 * configured must refuse to run, not silently accept unauthenticated
 * triggers. CRON_SECRET unset means every app/api/cron/* route stays
 * fully inert (401) until it's set — see lib/api/verifyCronSecret.ts.
 */
export const CRON_SECRET = process.env.CRON_SECRET || "";
export const IS_CRON_CONFIGURED = CRON_SECRET.length > 0;

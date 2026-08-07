import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ACCESS_COOKIE_NAME } from "@/config/auth";
import {
  AUTH_HEADER_EMAIL,
  AUTH_HEADER_ORG_ID,
  AUTH_HEADER_ROLE,
  AUTH_HEADER_USER_ID,
  AUTH_HEADER_SESSION_ID,
  AUTH_HEADER_PLATFORM_ROLE,
} from "@/lib/api/roles";
// Imports tokens.ts directly, NOT the lib/services/auth barrel — the
// barrel also re-exports authService, which pulls in lib/db/registry.ts
// (every entity's in-memory repository, several using node:crypto) and
// broke this Edge-runtime bundle (Turbopack: "A Node.js module is loaded
// ('crypto') which is not supported in the Edge Runtime"). tokens.ts
// alone only depends on jose (Web Crypto) and stays fully edge-safe —
// this is the one place in the app allowed to reach around the barrel.
import { verifyAccessToken } from "@/lib/services/auth/tokens";

const LOGIN_PAGE_PATH = "/admin/login";
/** RC-7 — a second "auth entry" page alongside login: reachable with NO
 *  session, and — like LOGIN_PAGE_PATH — redirects an ALREADY-
 *  authenticated visitor away (to /admin, which itself resolves onward
 *  to the onboarding wizard or the dashboard depending on real
 *  server-side state — see the onboarding status route). A logged-in
 *  user has no reason to see a fresh signup form. */
const REGISTER_PAGE_PATH = "/admin/register";
/** RC-1 — genuinely public `/admin/*` pages: reachable with NO session
 *  at all (unlike every other `/admin/*` page). Unlike LOGIN_PAGE_PATH/
 *  REGISTER_PAGE_PATH, none of these redirect an already-authenticated
 *  visitor away — a logged-in user legitimately might still open a
 *  password-reset, email-verification, or (RC-7) team-invitation link
 *  from their inbox (e.g. changing their email, a second browser
 *  profile, or an invite addressed to a different email than their
 *  current session), and forcing them back to /admin first would just
 *  break that link for no real security benefit. */
const OTHER_PUBLIC_PAGE_PATHS = new Set(["/admin/forgot-password", "/admin/reset-password", "/admin/verify-email", "/admin/accept-invite"]);

/**
 * The sole place authentication happens (Module 9). Verifies the
 * access-token cookie's JWT signature/expiry via jose (Web Crypto —
 * portable to this Edge-runtime middleware, unlike node:crypto-based
 * jsonwebtoken) and, if valid, injects trusted x-auth-* request headers
 * that lib/api/roles.ts's getAuthContext() reads. A route handler never
 * parses the cookie or verifies the JWT itself — it only ever trusts
 * these headers, which is what makes them safe to trust: a client
 * cannot spoof x-auth-role by sending the header itself, because any
 * client-supplied copy is deleted below before this middleware sets its
 * own verified values.
 *
 * Two different responses to "not authenticated," depending on what was
 * requested (Module 11 — CRM Dashboard UI added the page-route half of
 * this): an `/api/*` request gets a JSON 401 (unchanged since Module 9 —
 * a fetch() caller expects a body it can parse, not a redirect); a
 * dashboard *page* request gets redirected to /admin/login?from=<path>,
 * since a browser navigating to a protected page should land on a
 * sign-in form, not a raw JSON error. /admin/login itself is exempted
 * from the check (it must be reachable while unauthenticated — that's
 * the whole point) and instead redirects *away* to /admin if a valid
 * session already exists, so a logged-in user doesn't land back on the
 * sign-in form via a stale bookmark or the back button. RC-1 adds three
 * more genuinely public pages (OTHER_PUBLIC_PAGE_PATHS below) — forgot/
 * reset-password and email verification all need to work for a visitor
 * with no session at all, the same reason /admin/login does.
 *
 * Role is deliberately NOT checked here for page routes — only "is
 * there a valid session at all." Every dashboard page still calls the
 * real `/api/admin/*` endpoints to render its data, and those already
 * enforce requiredRole: "admin" (lib/api/withApiRoute.ts) and return a
 * normal 403 the UI can render as "you don't have permission to view
 * this" — a clearer message than a middleware-level block could give
 * without duplicating per-route role requirements here too.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isApiRequest = pathname.startsWith("/api/");

  const token = request.cookies.get(AUTH_ACCESS_COOKIE_NAME)?.value;
  const claims = token ? await verifyAccessToken(token) : null;

  if (pathname === LOGIN_PAGE_PATH || pathname === REGISTER_PAGE_PATH) {
    if (claims) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (OTHER_PUBLIC_PAGE_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (!claims) {
    if (isApiRequest) {
      return NextResponse.json(
        { success: false, errors: [{ field: "root", message: "Authentication required." }] },
        { status: 401 },
      );
    }
    const loginUrl = new URL(LOGIN_PAGE_PATH, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const headers = new Headers(request.headers);
  headers.delete(AUTH_HEADER_USER_ID);
  headers.delete(AUTH_HEADER_EMAIL);
  headers.delete(AUTH_HEADER_ROLE);
  headers.delete(AUTH_HEADER_ORG_ID);
  headers.delete(AUTH_HEADER_SESSION_ID);
  headers.delete(AUTH_HEADER_PLATFORM_ROLE);
  headers.set(AUTH_HEADER_USER_ID, claims.sub);
  headers.set(AUTH_HEADER_EMAIL, claims.email);
  headers.set(AUTH_HEADER_ROLE, claims.role);
  // Business OS Phase 8, Module 8.1 — only forwarded when the verified
  // token actually carries one (see tokens.ts's own verifyAccessToken
  // doc comment on why that's tolerated rather than rejecting the
  // token). withApiRoute.ts resolves the real default organization
  // server-side (Edge-runtime-incompatible — mongoose can't run here,
  // which is exactly why that resolution can't happen in this file)
  // for an authenticated request that reaches it with no org header at
  // all.
  // RC-7 — no longer resolved server-side "for free" when absent: a
  // verified token with no organizationId claim is now a real,
  // meaningful state (a mid-onboarding user — see withApiRoute.ts's own
  // "RC-7" doc comment), not something withApiRoute silently
  // substitutes a default for anymore.
  if (claims.organizationId) {
    headers.set(AUTH_HEADER_ORG_ID, claims.organizationId);
  }
  if (claims.sessionId) {
    headers.set(AUTH_HEADER_SESSION_ID, claims.sessionId);
  }
  // RC-6 — same "only forwarded when the verified token actually
  // carries one" posture as organizationId/sessionId above. Absent for
  // every ordinary tenant user's token, forever.
  if (claims.platformRole) {
    headers.set(AUTH_HEADER_PLATFORM_ROLE, claims.platformRole);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  /**
   * RC-1 — every `/api/auth/*` route that declares `requiredRole` MUST
   * be listed here individually (Next.js matcher entries aren't regex-
   * exclude, so this stays an explicit allowlist, the same style
   * `/api/auth/me` already established). `withApiRoute`'s own
   * `requiredRole` check trusts `x-auth-*` request headers unconditionally
   * (see roles.ts's getAuthContext()) — it never re-verifies the JWT
   * itself. A route that declares `requiredRole` but is missing from
   * this matcher never gets its x-auth-* headers verified-and-set (or a
   * client-supplied copy stripped) at all, so `withApiRoute` ends up
   * trusting whatever `x-auth-user-id`/`x-auth-role` headers the CLIENT
   * sent directly — a full authentication bypass. This exact gap
   * existed for change-password/sessions/login-history/every mfa/*
   * route until this fix; every one of those now appears below.
   *
   * The genuinely public `/api/auth/*` routes (login, logout, refresh,
   * forgot-password, reset-password, verify-email,
   * mfa/request-email-otp, oauth/providers, oauth/[provider]/authorize,
   * oauth/[provider]/callback) are deliberately NOT listed — they carry
   * no `requiredRole` and must stay reachable by a request with no
   * session at all. The oauth authorize/callback routes verify the
   * access-token cookie themselves (see oauthService.ts) when they need
   * to know whether a request is already logged in, rather than relying
   * on this middleware.
   */
  matcher: [
    "/api/admin/:path*",
    // RC-7 — Customer Onboarding & SaaS Activation. These routes read
    // ctx.authContext.userId/organizationId to make real authorization
    // decisions (withApiRoute.ts's own pre-organization gate included)
    // — without this matcher entry, a request would reach them with
    // whatever raw x-auth-* headers the CLIENT sent directly, never
    // stripped or re-verified, the exact full-authentication-bypass gap
    // this matcher's own doc comment above warns every requiredRole
    // route about. Not covered by "/api/admin/:path*" — these
    // deliberately live outside that prefix (see onboarding.
    // organization.create's own route doc comment).
    "/api/onboarding/:path*",
    // RC-8 — Documentation, API Documentation & Operational Knowledge
    // Base. Both docs.* routes declare requiredRole: "admin" — the
    // exact same real-authorization-decision shape the RC-7 comment
    // above warns about. Found live, not by code review: a fresh
    // manual verification pass (register → verify → create org →
    // hit /api/docs/reference with a real admin session) returned
    // "Authentication required" despite a valid session cookie, because
    // this entry was missing and getAuthContext() never saw a trusted
    // x-auth-* header for this prefix. Not covered by
    // "/api/admin/:path*" — these deliberately live outside that
    // prefix (see app/api/docs/openapi.json/route.ts's own doc
    // comment for why).
    "/api/docs/:path*",
    "/api/auth/me",
    "/api/auth/change-password",
    "/api/auth/resend-verification",
    "/api/auth/login-history",
    "/api/auth/sessions",
    "/api/auth/sessions/:path*",
    "/api/auth/mfa/setup",
    "/api/auth/mfa/confirm",
    "/api/auth/mfa/disable",
    "/api/auth/mfa/recovery-codes",
    "/api/auth/mfa/trusted-devices",
    "/api/auth/mfa/trusted-devices/:path*",
    "/api/auth/oauth/accounts",
    "/api/auth/oauth/accounts/:path*",
    "/admin/:path*",
  ],
};

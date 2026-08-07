import { SignJWT } from "jose";
import type { APIRequestContext, BrowserContext } from "@playwright/test";

/**
 * Mints an access-token cookie matching the exact contract
 * middleware.ts/lib/services/auth/tokens.ts verify (HS256, jose,
 * {sub, email, role, organizationId} claims) — without needing a real
 * seeded user. There is no way to seed a user into the webServer's own
 * in-memory process from a separate test process (each `npx tsx`/test
 * runner invocation is its own process with its own store — the same
 * constraint documented on scripts/createAdminUser.ts), so this is the
 * same technique used manually throughout this project's stabilization
 * work, now automated. The secret here MUST match playwright.config.ts's
 * webServer.env.JWT_ACCESS_TOKEN_SECRET exactly.
 */
const TEST_JWT_SECRET = "playwright-test-secret-at-least-32-characters-long";
const ACCESS_COOKIE_NAME = "ls_access_token";

export type TestRole = "admin" | "manager" | "counsellor";

/**
 * Generalized session-cookie minting for any of the 3 RBAC tiers (Phase
 * 1 hardening) — `addAdminSessionCookie` below is a thin admin-only
 * wrapper kept for the existing specs that only ever needed one role.
 * `id`/`email` are overridable so a test can mint two distinct
 * counsellor sessions (e.g. "does counsellor A get 403 on counsellor
 * B's lead") without them colliding on the same subject id.
 *
 * `organizationId` is overridable too, added for Module 8.1's own
 * cross-tenant attack suite (tenantIsolation.spec.ts) — when omitted,
 * defaults to the deployment's own REAL default organization (see
 * `resolveDefaultOrganizationId` below), not a fabricated stand-in id.
 *
 * RC-7 changed what an omitted organizationId means server-side:
 * withApiRoute.ts's own pre-organization gate now REJECTS an
 * authenticated request with no org claim outright (a mid-registration
 * user's own real shape — see that file's "RC-7" doc comment) instead
 * of the old silent fallback to `ensureDefaultOrganization()`. That old
 * fallback is exactly what every zero-arg call site across this whole
 * suite (100+ of them) was implicitly relying on to get a real, *shared*
 * tenant scope — removing it without a replacement broke every one of
 * those specs at once (confirmed live: a full suite run immediately
 * after RC-7's withApiRoute.ts change turned 65 previously-passing
 * specs red). A plain fixed string was the first fix attempted here and
 * is NOT enough on its own: several specs (crm-leads, lead-ai-insights,
 * rbac, webhook-monitoring) create data via the genuinely public
 * `/api/leads`/`/api/registrations`/`/api/webhooks/*` routes, which
 * aren't in middleware.ts's own matcher at all (see that file's own
 * matcher doc comment) — a session cookie attached to that request is
 * never converted into trusted headers, so those routes always resolve
 * the REAL `ensureDefaultOrganization()` id server-side regardless of
 * which session made the call. An admin session mistakenly minted with
 * a different, fabricated org id would then never see data created that
 * way. `resolveDefaultOrganizationId` closes that gap by learning the
 * REAL id the same way those public routes do, via one real HTTP round
 * trip, rather than guessing.
 */
let cachedDefaultOrganizationId: Promise<string> | null = null;

/** Learns the deployment's real default organization id the same way
 *  a genuinely public, unauthenticated route already does —
 *  `ensureDefaultOrganization()`, triggered here via one real
 *  `POST /api/leads` (itself already exercised elsewhere in this
 *  suite) rather than reached into directly (this test process and the
 *  webServer are separate processes with separate in-memory stores —
 *  see this file's own top-of-file doc comment). Cached for the whole
 *  test run: `ensureDefaultOrganization()` is idempotent/find-or-create,
 *  so every caller within the same webServer process run gets the
 *  identical id back regardless of how many times this resolves. */
async function resolveDefaultOrganizationId(request: APIRequestContext, baseURL: string): Promise<string> {
  if (!cachedDefaultOrganizationId) {
    cachedDefaultOrganizationId = request
      .post(`${baseURL}/api/leads`, {
        headers: { origin: baseURL },
        data: {
          name: "E2E Default Org Bootstrap",
          email: `e2e-default-org-bootstrap-${Date.now()}@example.com`,
          phone: "+919800000099",
          source: "e2e-helpers-bootstrap",
        },
      })
      .then(async (response) => {
        const body = (await response.json()) as { lead: { organizationId: string } };
        return body.lead.organizationId;
      });
  }
  return cachedDefaultOrganizationId;
}

export async function addSessionCookie(
  context: BrowserContext,
  baseURL: string,
  role: TestRole,
  /** `organizationId: null` is a deliberate, explicit "mint a token
   *  with NO organizationId claim at all" — the exact shape a
   *  mid-registration RC-7 user's own token has (see
   *  withApiRoute.unit.test.ts's own "RC-7 pre-organization gate"
   *  suite and tests/e2e/onboarding.spec.ts, this option's only real
   *  callers). Distinct from simply omitting the field, which now
   *  means "use the deployment's real default organization" (see
   *  `resolveDefaultOrganizationId` above). */
  opts: { id?: string; email?: string; organizationId?: string | null } = {},
): Promise<string> {
  const id = opts.id ?? `e2e-test-${role}-id`;
  const email = opts.email ?? `e2e-${role}@test.local`;
  const organizationId = opts.organizationId === null ? null : (opts.organizationId ?? (await resolveDefaultOrganizationId(context.request, baseURL)));

  const secretKey = new TextEncoder().encode(TEST_JWT_SECRET);
  const claims: Record<string, string> = { email, role };
  if (organizationId !== null) claims.organizationId = organizationId;
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(secretKey);

  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: ACCESS_COOKIE_NAME,
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  return id;
}

export async function addAdminSessionCookie(context: BrowserContext, baseURL: string): Promise<void> {
  await addSessionCookie(context, baseURL, "admin", { id: "e2e-test-admin-id", email: "e2e-admin@test.local" });
}

import { SignJWT } from "jose";
import type { BrowserContext } from "@playwright/test";

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
 * cross-tenant attack suite (tenantIsolation.spec.ts) — but when
 * omitted, the minted token deliberately carries NO organizationId
 * claim at all, rather than a fabricated stand-in id. withApiRoute.ts's
 * own doc comment covers why: an authenticated request with no org
 * claim resolves the deployment's one REAL default organization
 * server-side (the same organization every public, unauthenticated
 * route's own writes — Lead capture, inbound webhooks — already stamp
 * themselves, via ensureDefaultOrganization()). A fabricated constant
 * string here would never equal that real, runtime-generated id,
 * silently breaking every pre-existing spec that creates data one way
 * and reads it back another — exactly the bug this comment replaces.
 */
export async function addSessionCookie(
  context: BrowserContext,
  baseURL: string,
  role: TestRole,
  opts: { id?: string; email?: string; organizationId?: string } = {},
): Promise<string> {
  const id = opts.id ?? `e2e-test-${role}-id`;
  const email = opts.email ?? `e2e-${role}@test.local`;

  const secretKey = new TextEncoder().encode(TEST_JWT_SECRET);
  const claims: Record<string, string> = { email, role };
  if (opts.organizationId) claims.organizationId = opts.organizationId;
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

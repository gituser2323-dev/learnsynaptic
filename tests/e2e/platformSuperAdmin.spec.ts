import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console. The mission's
 * own explicit requirement: "Do not declare success simply because
 * /platform renders. Prove ordinary tenant users cannot access platform
 * operations" and "hiding UI is not security — direct HTTP requests
 * from tenant users to platform APIs must fail."
 *
 * Scope note, disclosed the same way tenantIsolation.spec.ts's own doc
 * comment discloses its scope: this file proves the NEGATIVE path over
 * real HTTP for every tenant role and for forged/unrecognized platform
 * claims — the side this mission is most explicit about needing proof
 * for. It does NOT exercise the full POSITIVE path (a genuine platform
 * operator successfully suspending/inspecting an organization), because
 * that path requires two things this webServer's fresh in-memory
 * process (see this suite's own playwright.config.ts doc comment) can't
 * provide without contradicting RC-6's own design: (1) `platformRole`
 * is deliberately grantable ONLY via the CLI bootstrap script
 * (scripts/bootstrapPlatformSuperAdmin.ts) — there is no HTTP route
 * that sets it, by design, so no in-process JWT-minting technique can
 * honestly stand in for it; (2) the platform MFA gate
 * (assertPlatformMfaSatisfied) does a real DB read of the ACTING USER's
 * own `mfaEnabled` flag — a minted JWT's claims can't shortcut that.
 * The positive path is covered instead by withApiRoute.unit.test.ts's
 * `requiredPlatformRole` suite (mocked DB, asserts the 200/handler-
 * called path with MFA satisfied) and by this RC's own live-browser
 * verification against the real dev MongoDB (real TOTP MFA enrollment,
 * real CLI-granted platformRole, real suspend/reactivate/override
 * actions, real audit log entries) — see RC_6_AUDIT.md.
 */

const PLATFORM_ROUTES = [
  { method: "GET" as const, path: "/api/admin/platform/dashboard" },
  { method: "GET" as const, path: "/api/admin/platform/organizations" },
  { method: "GET" as const, path: "/api/admin/platform/jobs" },
  { method: "GET" as const, path: "/api/admin/platform/security-events" },
  { method: "GET" as const, path: "/api/admin/platform/audit-log" },
  { method: "GET" as const, path: "/api/admin/platform/search?q=test" },
  { method: "POST" as const, path: "/api/admin/platform/organizations/000000000000000000000000/suspend", data: { reason: "pentest" } },
];

test.describe("RC-6 — Platform Super Admin negative-access suite", () => {
  for (const role of ["counsellor", "manager", "admin"] as const) {
    test(`a real ${role} session (no platformRole claim, even tenant-admin rank) gets a real 403 from every /api/admin/platform/* route`, async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext();
      await addSessionCookie(context, baseURL!, role, { id: `e2e-platform-neg-${role}`, email: `e2e-platform-neg-${role}@test.local` });

      for (const route of PLATFORM_ROUTES) {
        const res =
          route.method === "GET"
            ? await context.request.get(route.path)
            : await context.request.post(route.path, { data: route.data });
        expect.soft(res.status(), `${route.method} ${route.path} as tenant ${role}`).toBe(403);
      }

      await context.close();
    });
  }

  test("an unrecognized/forged platformRole JWT claim is dropped by token verification, not trusted", async ({ browser, baseURL }) => {
    // tokens.ts's own isPlatformRole() guard only accepts "super_admin";
    // any other string a forged/tampered token might carry is stripped
    // before it ever reaches authContext, the same real-over-HTTP proof
    // roles.unit.test.ts already gives at the unit level.
    const context = await browser.newContext();
    const email = "e2e-platform-forged-role@test.local";
    // addSessionCookie doesn't expose a platformRole param (by design —
    // no legitimate test path should need to mint one); mint the cookie
    // directly here with an extra, unrecognized platformRole claim.
    const { SignJWT } = await import("jose");
    const secretKey = new TextEncoder().encode("playwright-test-secret-at-least-32-characters-long");
    const token = await new SignJWT({ email, role: "admin", platformRole: "root" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("e2e-platform-forged-role")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(secretKey);
    const url = new URL(baseURL!);
    await context.addCookies([
      { name: "ls_access_token", value: token, domain: url.hostname, path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
    ]);

    const res = await context.request.get("/api/admin/platform/dashboard");
    expect(res.status()).toBe(403);

    await context.close();
  });

  test("a genuinely-claimed platformRole:super_admin with no matching real user still fails closed on the MFA gate — a JWT claim alone can never bypass the platform MFA requirement", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext();
    const { SignJWT } = await import("jose");
    const secretKey = new TextEncoder().encode("playwright-test-secret-at-least-32-characters-long");
    const token = await new SignJWT({ email: "e2e-platform-no-mfa@test.local", role: "admin", platformRole: "super_admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("e2e-platform-no-mfa-user-does-not-exist")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(secretKey);
    const url = new URL(baseURL!);
    await context.addCookies([
      { name: "ls_access_token", value: token, domain: url.hostname, path: "/", httpOnly: true, secure: false, sameSite: "Lax" },
    ]);

    const res = await context.request.get("/api/admin/platform/dashboard");
    // Fails closed: no matching user row => mfaEnabled can't be
    // confirmed => 403, never treated as "MFA is fine."
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.errors?.[0]?.message ?? "").toMatch(/multi-factor|access denied/i);

    await context.close();
  });
});

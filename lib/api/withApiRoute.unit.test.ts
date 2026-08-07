import { describe, it, expect, afterEach } from "vitest";
import { withApiRoute } from "./withApiRoute";
import { apiSuccess } from "./response";
import { getUserRepository, getOrganizationRepository } from "@/lib/db";
import {
  AUTH_HEADER_USER_ID,
  AUTH_HEADER_EMAIL,
  AUTH_HEADER_ROLE,
  AUTH_HEADER_PLATFORM_ROLE,
  AUTH_HEADER_ORG_ID,
} from "./roles";

/**
 * RC-2 Enterprise Security Hardening — `withApiRoute` is the one
 * cross-cutting wrapper every ~150 routes in this app go through
 * (rate limiting, RBAC, the new request-size ceiling), yet had zero
 * dedicated test coverage before this pass. Exercises the wrapper
 * directly against real `Request` objects, not a mocked handler chain.
 */

function trivialHandler() {
  return async () => apiSuccess({ ok: true });
}

describe("withApiRoute — request size ceiling (413)", () => {
  it("pentest — DoS via oversized body: rejects a request whose Content-Length exceeds the global ceiling, before the handler ever runs", async () => {
    let handlerCalled = false;
    const handler = withApiRoute("test.oversized", async () => {
      handlerCalled = true;
      return apiSuccess({ ok: true });
    });

    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-length": String(61 * 1024 * 1024) }, // over the 60MB ceiling
    });
    const response = await handler(request);

    expect(response.status).toBe(413);
    expect(handlerCalled).toBe(false);
  });

  it("allows a request within the size ceiling through to the handler", async () => {
    const handler = withApiRoute("test.normal-size", trivialHandler());
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-length": "1024" },
    });
    const response = await handler(request);
    expect(response.status).toBe(200);
  });

  it("allows a request with no Content-Length header through (can't reject on a signal that isn't present)", async () => {
    const handler = withApiRoute("test.no-content-length", trivialHandler());
    const request = new Request("http://localhost/api/test", { method: "GET" });
    const response = await handler(request);
    expect(response.status).toBe(200);
  });
});

describe("withApiRoute — rate limiting integration", () => {
  it("pentest — Rate-Limit Bypass: enforces the configured per-route limit end-to-end", async () => {
    const handler = withApiRoute("test.rate-limited-route", trivialHandler(), { rateLimit: { limit: 2, windowMs: 60_000 } });
    const makeRequest = () => new Request("http://localhost/api/test-rl", { headers: { "x-forwarded-for": "203.0.113.55" } });

    const first = await handler(makeRequest());
    const second = await handler(makeRequest());
    const third = await handler(makeRequest());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers.get("Retry-After")).toBeTruthy();
  });

  it("pentest — Rate-Limit Bypass: a different client IP gets its own independent budget", async () => {
    const handler = withApiRoute("test.rate-limited-route-2", trivialHandler(), { rateLimit: { limit: 1, windowMs: 60_000 } });
    const requestA = () => new Request("http://localhost/api/test-rl2", { headers: { "x-forwarded-for": "203.0.113.10" } });
    const requestB = () => new Request("http://localhost/api/test-rl2", { headers: { "x-forwarded-for": "203.0.113.20" } });

    await handler(requestA());
    const aBlocked = await handler(requestA());
    const bAllowed = await handler(requestB());

    expect(aBlocked.status).toBe(429);
    expect(bAllowed.status).toBe(200);
  });
});

describe("withApiRoute — MAINTENANCE_READ_ONLY_MODE (RC-5 recovery mode)", () => {
  const ORIGINAL = process.env.MAINTENANCE_READ_ONLY_MODE;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.MAINTENANCE_READ_ONLY_MODE;
    else process.env.MAINTENANCE_READ_ONLY_MODE = ORIGINAL;
  });

  it("refuses a mutating request with 503 when the flag is set", async () => {
    process.env.MAINTENANCE_READ_ONLY_MODE = "true";
    let handlerCalled = false;
    const handler = withApiRoute("test.mutating-route", async () => {
      handlerCalled = true;
      return apiSuccess({ ok: true });
    });

    const response = await handler(new Request("http://localhost/api/test", { method: "POST" }));

    expect(response.status).toBe(503);
    expect(handlerCalled).toBe(false);
  });

  it("still allows a GET request through when the flag is set (reads must stay available during an incident)", async () => {
    process.env.MAINTENANCE_READ_ONLY_MODE = "true";
    const handler = withApiRoute("test.read-route", trivialHandler());
    const response = await handler(new Request("http://localhost/api/test", { method: "GET" }));
    expect(response.status).toBe(200);
  });

  it("still allows an auth.*-named route through when the flag is set (must be able to sign in during an incident)", async () => {
    process.env.MAINTENANCE_READ_ONLY_MODE = "true";
    const handler = withApiRoute("auth.login", trivialHandler());
    const response = await handler(new Request("http://localhost/api/auth/login", { method: "POST" }));
    expect(response.status).toBe(200);
  });

  it("allows a mutating request through when the flag is unset (the only safe default)", async () => {
    delete process.env.MAINTENANCE_READ_ONLY_MODE;
    const handler = withApiRoute("test.mutating-route-2", trivialHandler());
    const response = await handler(new Request("http://localhost/api/test", { method: "POST" }));
    expect(response.status).toBe(200);
  });

  it("allows a mutating request through when the flag is set to anything other than the exact string \"true\"", async () => {
    process.env.MAINTENANCE_READ_ONLY_MODE = "1";
    const handler = withApiRoute("test.mutating-route-3", trivialHandler());
    const response = await handler(new Request("http://localhost/api/test", { method: "POST" }));
    expect(response.status).toBe(200);
  });
});

describe("withApiRoute — requiredPlatformRole (RC-6 platform authorization)", () => {
  async function createUser(overrides: { mfaEnabled?: boolean } = {}) {
    const repo = await getUserRepository();
    return repo.create({
      email: `platform-test-${Math.random().toString(36).slice(2)}@learnsynaptic.internal`,
      passwordHash: "irrelevant-for-this-test",
      role: "admin",
      status: "active",
    }).then(async (user) => (overrides.mfaEnabled ? repo.update(user.id, { mfaEnabled: true }) : user));
  }

  function requestAs(opts: { userId?: string; role?: string; platformRole?: string; method?: string }): Request {
    const headers = new Headers();
    if (opts.userId) {
      headers.set(AUTH_HEADER_USER_ID, opts.userId);
      headers.set(AUTH_HEADER_EMAIL, "test@learnsynaptic.internal");
      headers.set(AUTH_HEADER_ROLE, opts.role ?? "admin");
    }
    if (opts.platformRole) headers.set(AUTH_HEADER_PLATFORM_ROLE, opts.platformRole);
    return new Request("http://localhost/api/admin/platform/test", { method: opts.method ?? "GET", headers });
  }

  it("pentest — Privilege Escalation: a tenant admin (highest tenant rank, no platformRole claim) is rejected from a platform-gated route", async () => {
    const user = await createUser({ mfaEnabled: true });
    const handler = withApiRoute("test.platform-route-1", trivialHandler(), { requiredPlatformRole: "super_admin" });
    const response = await handler(requestAs({ userId: user.id, role: "admin" }));
    expect(response.status).toBe(403);
  });

  it("pentest — Unauthenticated Access: no auth headers at all is rejected with 401, not 403 (distinguishing 'not logged in' from 'logged in, wrong privilege')", async () => {
    const handler = withApiRoute("test.platform-route-2", trivialHandler(), { requiredPlatformRole: "super_admin" });
    const response = await handler(requestAs({}));
    expect(response.status).toBe(401);
  });

  it("a real platform operator with MFA enabled reaches the handler", async () => {
    const user = await createUser({ mfaEnabled: true });
    let handlerCalled = false;
    const handler = withApiRoute(
      "test.platform-route-3",
      async () => {
        handlerCalled = true;
        return apiSuccess({ ok: true });
      },
      { requiredPlatformRole: "super_admin" },
    );
    const response = await handler(requestAs({ userId: user.id, platformRole: "super_admin" }));
    expect(response.status).toBe(200);
    expect(handlerCalled).toBe(true);
  });

  it("a real platform operator WITHOUT MFA enabled is rejected — the mission's own explicit MFA requirement for the platform tier, enforced even when platformRole matches", async () => {
    const user = await createUser({ mfaEnabled: false });
    let handlerCalled = false;
    const handler = withApiRoute(
      "test.platform-route-4",
      async () => {
        handlerCalled = true;
        return apiSuccess({ ok: true });
      },
      { requiredPlatformRole: "super_admin" },
    );
    const response = await handler(requestAs({ userId: user.id, platformRole: "super_admin" }));
    expect(response.status).toBe(403);
    expect(handlerCalled).toBe(false);
  });

  it("pentest — a forged/unrecognized platformRole header value never satisfies the gate, even paired with a real userId", async () => {
    const user = await createUser({ mfaEnabled: true });
    const handler = withApiRoute("test.platform-route-5", trivialHandler(), { requiredPlatformRole: "super_admin" });
    const response = await handler(requestAs({ userId: user.id, platformRole: "root" }));
    expect(response.status).toBe(403);
  });

  it("a lower tenant role (counsellor) with a genuine platformRole claim still reaches the platform route — platform access is independent of tenant rank", async () => {
    const user = await createUser({ mfaEnabled: true });
    const handler = withApiRoute("test.platform-route-6", trivialHandler(), { requiredPlatformRole: "super_admin" });
    const response = await handler(requestAs({ userId: user.id, role: "counsellor", platformRole: "super_admin" }));
    expect(response.status).toBe(200);
  });
});

describe("withApiRoute — RC-6 tenant suspension enforcement", () => {
  async function createSuspendedOrg(): Promise<string> {
    const repo = await getOrganizationRepository();
    const org = await repo.create({ name: `Suspended Test Org ${Math.random()}`, slug: `suspended-test-${Math.random().toString(36).slice(2)}` });
    await repo.update(org.id, { status: "suspended", suspendedAt: new Date().toISOString(), suspendedReason: "test" });
    return org.id;
  }

  function requestFor(orgId: string, method: string): Request {
    const headers = new Headers({
      [AUTH_HEADER_USER_ID]: "user-1",
      [AUTH_HEADER_EMAIL]: "a@b.com",
      [AUTH_HEADER_ROLE]: "admin",
      [AUTH_HEADER_ORG_ID]: orgId,
    });
    return new Request("http://localhost/api/admin/test", { method, headers });
  }

  it("blocks a mutating request (POST) for a suspended organization", async () => {
    const orgId = await createSuspendedOrg();
    let handlerCalled = false;
    const handler = withApiRoute("test.suspended-write", async () => {
      handlerCalled = true;
      return apiSuccess({ ok: true });
    });
    const response = await handler(requestFor(orgId, "POST"));
    expect(response.status).toBe(403);
    expect(handlerCalled).toBe(false);
  });

  it("still allows a GET request for a suspended organization — historical data must remain readable", async () => {
    const orgId = await createSuspendedOrg();
    const handler = withApiRoute("test.suspended-read", trivialHandler());
    const response = await handler(requestFor(orgId, "GET"));
    expect(response.status).toBe(200);
  });

  it("still allows an auth.*-named route for a suspended organization — a suspended org's users must still be able to sign in", async () => {
    const orgId = await createSuspendedOrg();
    const handler = withApiRoute("auth.login", trivialHandler());
    const response = await handler(requestFor(orgId, "POST"));
    expect(response.status).toBe(200);
  });

  it("a platform-gated route is never blocked by tenant suspension — an operator must be able to act on the very org this would otherwise freeze", async () => {
    const orgId = await createSuspendedOrg();
    const repo = await getUserRepository();
    const operator = await repo.create({ email: `platform-op-${Math.random()}@learnsynaptic.internal`, passwordHash: "x", role: "admin", status: "active" });
    await repo.update(operator.id, { mfaEnabled: true, platformRole: "super_admin" });

    const headers = new Headers({
      [AUTH_HEADER_USER_ID]: operator.id,
      [AUTH_HEADER_EMAIL]: "ops@learnsynaptic.internal",
      [AUTH_HEADER_ROLE]: "admin",
      [AUTH_HEADER_ORG_ID]: orgId,
      [AUTH_HEADER_PLATFORM_ROLE]: "super_admin",
    });
    const handler = withApiRoute("test.platform-suspend-action", trivialHandler(), { requiredPlatformRole: "super_admin" });
    const response = await handler(new Request("http://localhost/api/admin/platform/test", { method: "POST", headers }));
    expect(response.status).toBe(200);
  });

  it("a mutating request for a real, active organization is never blocked", async () => {
    const repo = await getOrganizationRepository();
    const org = await repo.create({ name: `Active Test Org ${Math.random()}`, slug: `active-test-${Math.random().toString(36).slice(2)}` });
    const handler = withApiRoute("test.active-write", trivialHandler());
    const response = await handler(requestFor(org.id, "POST"));
    expect(response.status).toBe(200);
  });
});

describe("withApiRoute — RC-7 pre-organization gate (authenticated, no organizationId)", () => {
  function requestAsOrglessUser(routeName: string, method = "GET"): { handler: ReturnType<typeof withApiRoute>; request: Request } {
    const headers = new Headers({
      [AUTH_HEADER_USER_ID]: "orgless-user-1",
      [AUTH_HEADER_EMAIL]: "orgless@learnsynaptic.internal",
      [AUTH_HEADER_ROLE]: "admin",
      // Deliberately no AUTH_HEADER_ORG_ID — the exact shape of a
      // mid-onboarding RC-7 user's token: a real, verified identity
      // with no organization yet.
    });
    return { handler: withApiRoute(routeName, trivialHandler()), request: new Request("http://localhost/api/test", { method, headers }) };
  }

  it("pentest — a self-registered user with no organization is rejected (not silently scoped into the deployment's default org) on an ordinary tenant route", async () => {
    const { handler, request } = requestAsOrglessUser("admin.leads.list");
    const response = await handler(request);
    expect(response.status).toBe(403);
    const body = (await response.json()) as { errors: { message: string }[] };
    expect(body.errors[0].message).toMatch(/organization/i);
  });

  it("an auth.*-named route still works for an orgless user — signing out/refreshing must never be blocked by incomplete onboarding", async () => {
    const { handler, request } = requestAsOrglessUser("auth.logout", "POST");
    const response = await handler(request);
    expect(response.status).toBe(200);
  });

  it("an onboarding.*-named route still works for an orgless user — this is the exact escape hatch that lets them create their organization", async () => {
    const { handler, request } = requestAsOrglessUser("onboarding.organization.create", "POST");
    const response = await handler(request);
    expect(response.status).toBe(200);
  });

  it("a requiredPlatformRole route is exempt from this gate too — a platform operator's own organizationId is irrelevant to their platform-scoped work", async () => {
    const repo = await getUserRepository();
    const operator = await repo.create({ email: `orgless-platform-op-${Math.random()}@learnsynaptic.internal`, passwordHash: "x", role: "admin", status: "active" });
    await repo.update(operator.id, { mfaEnabled: true, platformRole: "super_admin" });
    const headers = new Headers({
      [AUTH_HEADER_USER_ID]: operator.id,
      [AUTH_HEADER_EMAIL]: "ops@learnsynaptic.internal",
      [AUTH_HEADER_ROLE]: "admin",
      [AUTH_HEADER_PLATFORM_ROLE]: "super_admin",
    });
    const handler = withApiRoute("test.platform-orgless", trivialHandler(), { requiredPlatformRole: "super_admin" });
    const response = await handler(new Request("http://localhost/api/admin/platform/test", { method: "GET", headers }));
    expect(response.status).toBe(200);
  });

  it("an unauthenticated request to an ordinary route is unaffected by this gate (still handled by the normal requiredRole/401 path, not this one)", async () => {
    const handler = withApiRoute("admin.leads.list", trivialHandler(), { requiredRole: "counsellor" });
    const response = await handler(new Request("http://localhost/api/test"));
    expect(response.status).toBe(401);
  });
});

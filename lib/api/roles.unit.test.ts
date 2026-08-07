import { describe, it, expect } from "vitest";
import {
  getAuthContext,
  hasRequiredRole,
  hasPlatformRole,
  AUTH_HEADER_USER_ID,
  AUTH_HEADER_EMAIL,
  AUTH_HEADER_ROLE,
  AUTH_HEADER_ORG_ID,
  AUTH_HEADER_PLATFORM_ROLE,
} from "./roles";

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console. `hasPlatformRole`
 * had zero dedicated coverage before this pass despite being the one
 * function every /api/admin/platform/* route's authorization ultimately
 * reduces to. The core property under test throughout: `platformRole`
 * and tenant `role` are read by two entirely separate functions — a
 * tenant admin (even the highest tenant rank) must never satisfy a
 * platform-role check, and a platform operator's own tenant `role`
 * value (whatever it happens to be) must never satisfy a platform check
 * on its own.
 */

function baseHeaders(overrides: Record<string, string> = {}): Headers {
  const headers = new Headers({
    [AUTH_HEADER_USER_ID]: "user-1",
    [AUTH_HEADER_EMAIL]: "a@b.com",
    [AUTH_HEADER_ROLE]: "admin",
  });
  for (const [key, value] of Object.entries(overrides)) headers.set(key, value);
  return headers;
}

describe("hasPlatformRole — RC-6 pentest: tenant/platform privilege separation", () => {
  it("a tenant admin (role:admin, no platformRole) never satisfies a platform-role check", () => {
    const context = getAuthContext(baseHeaders());
    expect(context.role).toBe("admin");
    expect(hasRequiredRole(context, "admin")).toBe(true); // sanity: tenant RBAC still works
    expect(hasPlatformRole(context, "super_admin")).toBe(false);
  });

  it.each(["counsellor", "manager", "admin"] as const)(
    "a tenant %s with no platformRole header never satisfies a platform-role check, regardless of tenant rank",
    (role) => {
      const context = getAuthContext(baseHeaders({ [AUTH_HEADER_ROLE]: role }));
      expect(context.role).toBe(role);
      expect(hasPlatformRole(context, "super_admin")).toBe(false);
    },
  );

  it("a genuine platform operator (platformRole:super_admin header present) satisfies the platform check regardless of their own tenant role", () => {
    const contextAsCounsellor = getAuthContext(
      baseHeaders({ [AUTH_HEADER_ROLE]: "counsellor", [AUTH_HEADER_PLATFORM_ROLE]: "super_admin" }),
    );
    expect(hasPlatformRole(contextAsCounsellor, "super_admin")).toBe(true);
  });

  it("an unrecognized platformRole header value is never trusted — getAuthContext drops it, not just hasPlatformRole", () => {
    const context = getAuthContext(baseHeaders({ [AUTH_HEADER_PLATFORM_ROLE]: "root" }));
    expect(context.platformRole).toBeUndefined();
    expect(hasPlatformRole(context, "super_admin")).toBe(false);
  });

  it("no platform header at all (the overwhelming majority of real requests) fails closed", () => {
    const context = getAuthContext(baseHeaders());
    expect(context.platformRole).toBeUndefined();
    expect(hasPlatformRole(context, "super_admin")).toBe(false);
  });

  it("an unauthenticated request (missing base identity headers) never satisfies a platform check even if a platform-role header is somehow present", () => {
    const headers = new Headers({ [AUTH_HEADER_PLATFORM_ROLE]: "super_admin" });
    const context = getAuthContext(headers);
    expect(context).toEqual({});
    expect(hasPlatformRole(context, "super_admin")).toBe(false);
  });

  it("organizationId presence/absence never affects the platform check — the two are unrelated axes", () => {
    const withOrg = getAuthContext(baseHeaders({ [AUTH_HEADER_ORG_ID]: "org-1", [AUTH_HEADER_PLATFORM_ROLE]: "super_admin" }));
    const withoutOrg = getAuthContext(baseHeaders({ [AUTH_HEADER_PLATFORM_ROLE]: "super_admin" }));
    expect(hasPlatformRole(withOrg, "super_admin")).toBe(true);
    expect(hasPlatformRole(withoutOrg, "super_admin")).toBe(true);
  });
});

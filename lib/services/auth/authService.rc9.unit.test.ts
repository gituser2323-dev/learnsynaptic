import { describe, it, expect } from "vitest";
import { authService } from "./authService";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { getUserRepository } from "@/lib/db";

/**
 * RC-9 — Full-System Validation, Load, Stress, Security & Failure
 * Testing. Regression coverage for a real, live-proven CRITICAL
 * cross-tenant leak found via direct UI testing (not a scripted API
 * attack): `authService.listActiveStaff()`'s own doc comment has the
 * full finding. `GET /api/admin/users` (the Lead Assignment / Task
 * assignee staff-picker, gated only at `requiredRole: "manager"`) used
 * to return EVERY organization's real staff directory (name, email,
 * role) to any manager/admin, regardless of which organization they
 * belonged to — confirmed live in a real browser session: Org A's own
 * admin saw Org B's and Org C's real staff listed by name in the Lead
 * list's "assigned counsellor" filter dropdown.
 */

let counter = 0;
function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${counter}@rc9-staff-test.local`;
}

describe("authService.listActiveStaff — RC-9 cross-tenant staff-directory isolation", () => {
  it("a Manager in Org A never sees Org B's real staff in the staff directory", async () => {
    const orgA = `org-staff-a-${Date.now()}`;
    const orgB = `org-staff-b-${Date.now()}`;
    const userRepository = await getUserRepository();

    const userA = await userRepository.create({
      email: uniqueEmail("org-a-counsellor"),
      passwordHash: "not-a-real-hash",
      role: "counsellor",
      status: "active",
      name: "Org A Counsellor",
      organizationId: orgA,
    });
    const userB = await userRepository.create({
      email: uniqueEmail("org-b-counsellor"),
      passwordHash: "not-a-real-hash",
      role: "counsellor",
      status: "active",
      name: "Org B Counsellor",
      organizationId: orgB,
    });

    const staffVisibleToOrgA = await runWithTenantContext({ organizationId: orgA }, () => authService.listActiveStaff());
    const ids = staffVisibleToOrgA.map((u) => u.id);

    expect(ids).toContain(userA.id);
    expect(ids).not.toContain(userB.id);
    expect(staffVisibleToOrgA.every((u) => u.id !== userB.id && u.name !== "Org B Counsellor")).toBe(true);
  });

  it("a Manager in Org B, symmetrically, never sees Org A's real staff either (not a one-directional fix)", async () => {
    const orgA = `org-staff-a2-${Date.now()}`;
    const orgB = `org-staff-b2-${Date.now()}`;
    const userRepository = await getUserRepository();

    const userA = await userRepository.create({
      email: uniqueEmail("org-a2-manager"),
      passwordHash: "not-a-real-hash",
      role: "manager",
      status: "active",
      name: "Org A2 Manager",
      organizationId: orgA,
    });
    const userB = await userRepository.create({
      email: uniqueEmail("org-b2-manager"),
      passwordHash: "not-a-real-hash",
      role: "manager",
      status: "active",
      name: "Org B2 Manager",
      organizationId: orgB,
    });

    const staffVisibleToOrgB = await runWithTenantContext({ organizationId: orgB }, () => authService.listActiveStaff());
    const ids = staffVisibleToOrgB.map((u) => u.id);

    expect(ids).toContain(userB.id);
    expect(ids).not.toContain(userA.id);
  });

  it("still returns every ACTIVE staff member within the caller's own organization (the fix doesn't over-filter legitimate same-org results)", async () => {
    const orgC = `org-staff-c-${Date.now()}`;
    const userRepository = await getUserRepository();

    const admin = await userRepository.create({
      email: uniqueEmail("org-c-admin"),
      passwordHash: "not-a-real-hash",
      role: "admin",
      status: "active",
      name: "Org C Admin",
      organizationId: orgC,
    });
    const manager = await userRepository.create({
      email: uniqueEmail("org-c-manager"),
      passwordHash: "not-a-real-hash",
      role: "manager",
      status: "active",
      name: "Org C Manager",
      organizationId: orgC,
    });
    const counsellor = await userRepository.create({
      email: uniqueEmail("org-c-counsellor"),
      passwordHash: "not-a-real-hash",
      role: "counsellor",
      status: "active",
      name: "Org C Counsellor",
      organizationId: orgC,
    });

    const staff = await runWithTenantContext({ organizationId: orgC }, () => authService.listActiveStaff());
    const ids = staff.map((u) => u.id);

    expect(ids).toEqual(expect.arrayContaining([admin.id, manager.id, counsellor.id]));
    // Never leaks passwordHash — same PublicUser projection every other
    // auth-facing response already uses.
    expect(staff.every((u) => !("passwordHash" in u))).toBe(true);
  });
});

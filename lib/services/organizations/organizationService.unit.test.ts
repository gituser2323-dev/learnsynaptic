import { describe, it, expect } from "vitest";
import { platformOrganizationService } from "./organizationService";
import { getOrganizationRepository } from "@/lib/db/registry";

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console. Real
 * in-memory-repository tests, no mocking — the same convention every
 * other service test file in this codebase already uses.
 */
describe("platformOrganizationService — suspension lifecycle", () => {
  it("suspendOrganization requires a non-empty reason — the mission's own 'dangerous action UX' requirement", async () => {
    const repo = await getOrganizationRepository();
    const org = await repo.create({ name: "RC6 No Reason Org", slug: `rc6-no-reason-${Math.random().toString(36).slice(2)}` });
    await expect(platformOrganizationService.suspendOrganization(org.id, "")).rejects.toThrow(/reason is required/);
    await expect(platformOrganizationService.suspendOrganization(org.id, "   ")).rejects.toThrow(/reason is required/);
  });

  it("suspendOrganization sets status, suspendedAt, and suspendedReason", async () => {
    const repo = await getOrganizationRepository();
    const org = await repo.create({ name: "RC6 Suspend Org", slug: `rc6-suspend-${Math.random().toString(36).slice(2)}` });

    const suspended = await platformOrganizationService.suspendOrganization(org.id, "Non-payment escalation");
    expect(suspended.status).toBe("suspended");
    expect(suspended.suspendedAt).toBeDefined();
    expect(suspended.suspendedReason).toBe("Non-payment escalation");
  });

  it("reactivateOrganization clears status, suspendedAt, AND suspendedReason entirely — never leaves stale suspension fields", async () => {
    const repo = await getOrganizationRepository();
    const org = await repo.create({ name: "RC6 Reactivate Org", slug: `rc6-reactivate-${Math.random().toString(36).slice(2)}` });
    await platformOrganizationService.suspendOrganization(org.id, "Abuse investigation");

    const reactivated = await platformOrganizationService.reactivateOrganization(org.id);
    expect(reactivated.status).toBe("active");
    expect(reactivated.suspendedAt).toBeUndefined();
    expect(reactivated.suspendedReason).toBeUndefined();
  });

  it("reactivateOrganization on an already-active organization is a safe, idempotent no-op", async () => {
    const repo = await getOrganizationRepository();
    const org = await repo.create({ name: "RC6 Already Active Org", slug: `rc6-active-${Math.random().toString(36).slice(2)}` });
    const reactivated = await platformOrganizationService.reactivateOrganization(org.id);
    expect(reactivated.status).toBe("active");
  });

  it("listOrganizations filters by status and search independently of each other", async () => {
    const repo = await getOrganizationRepository();
    const suffix = Math.random().toString(36).slice(2);
    const orgA = await repo.create({ name: `RC6 Filter Alpha ${suffix}`, slug: `rc6-filter-alpha-${suffix}` });
    const orgB = await repo.create({ name: `RC6 Filter Beta ${suffix}`, slug: `rc6-filter-beta-${suffix}` });
    await platformOrganizationService.suspendOrganization(orgB.id, "test");

    const suspendedOnly = await platformOrganizationService.listOrganizations({ status: "suspended" }, 1, 200);
    expect(suspendedOnly.items.some((o) => o.id === orgA.id)).toBe(false);
    expect(suspendedOnly.items.some((o) => o.id === orgB.id)).toBe(true);

    const searchResult = await platformOrganizationService.listOrganizations({ search: `Filter Alpha ${suffix}` }, 1, 200);
    expect(searchResult.items.some((o) => o.id === orgA.id)).toBe(true);
    expect(searchResult.items.some((o) => o.id === orgB.id)).toBe(false);
  });

  it("getOrganization returns null for a nonexistent id rather than throwing", async () => {
    const result = await platformOrganizationService.getOrganization("does-not-exist");
    expect(result).toBeNull();
  });
});

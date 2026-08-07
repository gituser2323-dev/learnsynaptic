import { describe, it, expect } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { leadService } from "./leadService";

/**
 * RC-9 — Full-System Validation, Load, Stress, Security & Failure
 * Testing. A real bug found via live cross-tenant pentesting: `bulkTag`
 * used to return `{matchedCount: targets.length, matchedIds: targets}`
 * — echoing the caller-supplied ids straight back regardless of
 * whether `repository.findById()` (the actually tenant-scoped call)
 * ever found a real lead for that id. Confirmed live: an id belonging
 * to a different organization, and a completely fabricated id, were
 * both reported as "matched." The underlying write was always
 * correctly scoped (never touched another tenant's data) — this was a
 * response-accuracy bug, not a tenant-isolation breach — but the fix
 * (leadService.ts's own doc comment on bulkTag) makes matchedCount/
 * matchedIds reflect what was genuinely found, matching every sibling
 * bulk method's already-correct shape. See RC_9_AUDIT.md for the full
 * live-pentest finding this unit test guards against regressing.
 */
describe("leadService.bulkTag — matchedCount/matchedIds reflect real, tenant-scoped matches", () => {
  it("never reports a nonexistent id as matched", async () => {
    const result = await runWithTenantContext({ organizationId: "org-bulktag-fake-ids" }, () =>
      leadService.bulkTag(["000000000000000000000000", "also-not-real"], undefined, "some-tag"),
    );
    expect(result.matchedCount).toBe(0);
    expect(result.matchedIds).toEqual([]);
  });

  it("never reports a DIFFERENT organization's real lead id as matched", async () => {
    const created = await runWithTenantContext({ organizationId: "org-bulktag-owner" }, () =>
      leadService.registerLead({ name: "Owner Org Lead", email: "owner-lead@example.com", phone: "+919800000001", source: "unit-test" }),
    );
    if (!created.success) throw new Error(`seed lead creation failed: ${JSON.stringify(created.errors)}`);
    const realLeadIdFromAnotherOrg = created.lead.id;

    const attackerResult = await runWithTenantContext({ organizationId: "org-bulktag-attacker" }, () =>
      leadService.bulkTag([realLeadIdFromAnotherOrg], undefined, "hijacked"),
    );
    expect(attackerResult.matchedCount).toBe(0);
    expect(attackerResult.matchedIds).toEqual([]);

    // Confirm the real owner's lead was never actually tagged by the cross-tenant attempt.
    const ownerView = await runWithTenantContext({ organizationId: "org-bulktag-owner" }, () => leadService.getLead(realLeadIdFromAnotherOrg));
    expect(ownerView?.tags ?? []).not.toContain("hijacked");
  });

  it("correctly reports a real, same-tenant lead as matched, whether newly tagged or already tagged", async () => {
    const created = await runWithTenantContext({ organizationId: "org-bulktag-same-tenant" }, () =>
      leadService.registerLead({ name: "Same Tenant Lead", email: "same-tenant-lead@example.com", phone: "+919800000002", source: "unit-test" }),
    );
    if (!created.success) throw new Error(`seed lead creation failed: ${JSON.stringify(created.errors)}`);
    const leadId = created.lead.id;

    const first = await runWithTenantContext({ organizationId: "org-bulktag-same-tenant" }, () => leadService.bulkTag([leadId], undefined, "vip"));
    expect(first.matchedCount).toBe(1);
    expect(first.matchedIds).toEqual([leadId]);

    // Re-tagging with the same tag: still a real match (the lead still
    // exists and belongs to this tenant), even though no write happens
    // this time (idempotent — the tag was already present).
    const second = await runWithTenantContext({ organizationId: "org-bulktag-same-tenant" }, () => leadService.bulkTag([leadId], undefined, "vip"));
    expect(second.matchedCount).toBe(1);
    expect(second.matchedIds).toEqual([leadId]);
  });
});

import { describe, it, expect } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { leadCaptureFormService } from "./leadCaptureFormService";

function uniqueOrg(label: string): string {
  return `org-lcf-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("leadCaptureFormService.createForm", () => {
  it("rejects a missing name", async () => {
    const result = await runWithTenantContext({ organizationId: uniqueOrg("validation") }, () => leadCaptureFormService.createForm({}));
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
  });

  it("generates a publicSlug derived from the name", async () => {
    const org = uniqueOrg("slug");
    const result = await runWithTenantContext({ organizationId: org }, () =>
      leadCaptureFormService.createForm({ name: "Website Contact Form" }),
    );
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.form.publicSlug).toBe("website-contact-form");
    expect(result.form.active).toBe(true);
    expect(result.form.submissionCount).toBe(0);
    expect(result.form.duplicateCount).toBe(0);
  });

  it("appends a random suffix on a slug collision rather than failing", async () => {
    const orgA = uniqueOrg("collision-a");
    const orgB = uniqueOrg("collision-b");
    const first = await runWithTenantContext({ organizationId: orgA }, () =>
      leadCaptureFormService.createForm({ name: "Contact" }),
    );
    expect(first.success).toBe(true);

    // A DIFFERENT organization picking the same name must still succeed —
    // publicSlug is globally unique (see the model's own doc comment),
    // not compound with organizationId, so this exercises the real
    // collision-retry path, not just a same-tenant duplicate-label case.
    const second = await runWithTenantContext({ organizationId: orgB }, () =>
      leadCaptureFormService.createForm({ name: "Contact" }),
    );
    expect(second.success).toBe(true);
    if (!first.success || !second.success) throw new Error("expected both to succeed");
    expect(second.form.publicSlug).not.toBe(first.form.publicSlug);
    expect(second.form.publicSlug.startsWith("contact")).toBe(true);
  });
});

describe("leadCaptureFormService — tenant isolation", () => {
  it("listForms only returns the active organization's own forms", async () => {
    const orgA = uniqueOrg("list-a");
    const orgB = uniqueOrg("list-b");
    await runWithTenantContext({ organizationId: orgA }, () => leadCaptureFormService.createForm({ name: "Org A Form" }));
    await runWithTenantContext({ organizationId: orgB }, () => leadCaptureFormService.createForm({ name: "Org B Form" }));

    const listA = await runWithTenantContext({ organizationId: orgA }, () => leadCaptureFormService.listForms());
    expect(listA.map((f) => f.name)).toEqual(["Org A Form"]);

    const listB = await runWithTenantContext({ organizationId: orgB }, () => leadCaptureFormService.listForms());
    expect(listB.map((f) => f.name)).toEqual(["Org B Form"]);
  });
});

describe("leadCaptureFormService.updateForm / deleteForm", () => {
  it("updateForm can pause a form (active: false)", async () => {
    const org = uniqueOrg("update");
    const created = await runWithTenantContext({ organizationId: org }, () => leadCaptureFormService.createForm({ name: "Toggle Me" }));
    if (!created.success) throw new Error("seed failed");

    const updated = await runWithTenantContext({ organizationId: org }, () =>
      leadCaptureFormService.updateForm(created.form.id, { active: false }),
    );
    expect(updated.success).toBe(true);
    if (!updated.success) throw new Error("expected success");
    expect(updated.form.active).toBe(false);
  });

  it("deleteForm removes the form from listForms", async () => {
    const org = uniqueOrg("delete");
    const created = await runWithTenantContext({ organizationId: org }, () => leadCaptureFormService.createForm({ name: "Delete Me" }));
    if (!created.success) throw new Error("seed failed");

    await runWithTenantContext({ organizationId: org }, () => leadCaptureFormService.deleteForm(created.form.id));
    const list = await runWithTenantContext({ organizationId: org }, () => leadCaptureFormService.listForms());
    expect(list.find((f) => f.id === created.form.id)).toBeUndefined();
  });
});

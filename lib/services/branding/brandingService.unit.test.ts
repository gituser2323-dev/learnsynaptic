import { describe, it, expect } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { planService, subscriptionService } from "@/lib/services/billing";
import { fileStorageService } from "@/lib/services/storage";
import { brandingService } from "./brandingService";
import { resolveBranding, invalidateBrandingCache } from "./themeResolver";

async function givenPlanWithCapabilities(planId: string, capabilities: string[]) {
  await planService.createPlan({
    id: planId,
    name: planId,
    description: "Test plan.",
    status: "active",
    billingInterval: "monthly",
    currency: "INR",
    basePriceInSmallestUnit: 0,
    capabilities: capabilities as never,
    limits: {},
  });
}

describe("brandingService — entitlement gating", () => {
  it("rejects saving branding for an organization whose plan lacks white_label", async () => {
    await givenPlanWithCapabilities("plan-brand-no-wl", ["crm"]);
    await subscriptionService.assignPlan("org-brand-no-wl", "plan-brand-no-wl");

    const result = await brandingService.updateConfiguration("org-brand-no-wl", { displayName: "Acme" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("not_entitled");
  });

  it("accepts saving branding for an organization whose plan includes white_label", async () => {
    await givenPlanWithCapabilities("plan-brand-wl", ["crm", "white_label"]);
    await subscriptionService.assignPlan("org-brand-wl", "plan-brand-wl");

    const result = await brandingService.updateConfiguration("org-brand-wl", { displayName: "Acme Corp" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.displayName).toBe("Acme Corp");
  });
});

describe("brandingService — asset ownership verification", () => {
  it("rejects a fileId belonging to a different organization, never trusting the id alone", async () => {
    await givenPlanWithCapabilities("plan-brand-asset", ["white_label", "file_storage"]);
    await subscriptionService.assignPlan("org-brand-asset-owner", "plan-brand-asset");
    await subscriptionService.assignPlan("org-brand-asset-other", "plan-brand-asset");

    const upload = await runWithTenantContext({ organizationId: "org-brand-asset-owner" }, () =>
      fileStorageService.uploadFile({
        buffer: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
        originalFilename: "logo.svg",
        mimeType: "image/svg+xml",
        category: "ORGANIZATION_ASSET",
        visibility: "public",
        organizationId: "org-brand-asset-owner",
      }),
    );
    expect(upload.success).toBe(true);
    if (!upload.success) return;

    const result = await brandingService.updateConfiguration("org-brand-asset-other", { logoFileId: upload.file.id });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("asset_not_found");
  });

  it("accepts a fileId the organization genuinely owns", async () => {
    await givenPlanWithCapabilities("plan-brand-asset-own", ["white_label", "file_storage"]);
    await subscriptionService.assignPlan("org-brand-asset-valid", "plan-brand-asset-own");

    const upload = await runWithTenantContext({ organizationId: "org-brand-asset-valid" }, () =>
      fileStorageService.uploadFile({
        buffer: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
        originalFilename: "logo.svg",
        mimeType: "image/svg+xml",
        category: "ORGANIZATION_ASSET",
        visibility: "public",
        organizationId: "org-brand-asset-valid",
      }),
    );
    expect(upload.success).toBe(true);
    if (!upload.success) return;

    const result = await brandingService.updateConfiguration("org-brand-asset-valid", { logoFileId: upload.file.id });
    expect(result.success).toBe(true);
  });
});

describe("brandingService / themeResolver — default fallback and reset", () => {
  it("an organization with no configuration resolves to the safe default, unbranded", async () => {
    await givenPlanWithCapabilities("plan-brand-unconfigured", ["white_label"]);
    await subscriptionService.assignPlan("org-brand-unconfigured", "plan-brand-unconfigured");

    const resolved = await resolveBranding("org-brand-unconfigured");
    expect(resolved.isCustom).toBe(false);
    expect(resolved.displayName).toBe("LearnSynaptic");
    expect(resolved.cssVariables).toEqual({});
  });

  it("an entitled, configured organization resolves real custom branding with derived accent shades", async () => {
    await givenPlanWithCapabilities("plan-brand-configured", ["white_label"]);
    await subscriptionService.assignPlan("org-brand-configured", "plan-brand-configured");
    await brandingService.updateConfiguration("org-brand-configured", { displayName: "Acme Corp", accentColor: "#15803d" });

    const resolved = await resolveBranding("org-brand-configured");
    expect(resolved.isCustom).toBe(true);
    expect(resolved.displayName).toBe("Acme Corp");
    expect(resolved.cssVariables["--adm-accent"]).toBe("#15803d");
    expect(resolved.cssVariables["--adm-accent-hover"]).toBeDefined();
    expect(resolved.cssVariables["--adm-accent-soft"]).toBeDefined();
  });

  it("reset deletes the configuration entirely — a subsequent resolve is indistinguishable from never-configured", async () => {
    await givenPlanWithCapabilities("plan-brand-reset", ["white_label"]);
    await subscriptionService.assignPlan("org-brand-reset", "plan-brand-reset");
    await brandingService.updateConfiguration("org-brand-reset", { displayName: "Temporary Name" });
    expect((await resolveBranding("org-brand-reset")).isCustom).toBe(true);

    await brandingService.resetConfiguration("org-brand-reset");
    const afterReset = await resolveBranding("org-brand-reset");
    expect(afterReset.isCustom).toBe(false);
    expect(afterReset.displayName).toBe("LearnSynaptic");
    expect(await brandingService.getRawConfiguration("org-brand-reset")).toBeNull();
  });

  it("a downgrade (losing the white_label capability) collapses a previously-saved configuration back to default — the row still exists, but is never applied", async () => {
    await givenPlanWithCapabilities("plan-brand-downgrade-from", ["white_label"]);
    await givenPlanWithCapabilities("plan-brand-downgrade-to", ["crm"]);
    await subscriptionService.assignPlan("org-brand-downgrade", "plan-brand-downgrade-from");
    await brandingService.updateConfiguration("org-brand-downgrade", { displayName: "Was Branded" });
    expect((await resolveBranding("org-brand-downgrade")).isCustom).toBe(true);

    await subscriptionService.assignPlan("org-brand-downgrade", "plan-brand-downgrade-to");
    invalidateBrandingCache("org-brand-downgrade");
    const afterDowngrade = await resolveBranding("org-brand-downgrade");
    expect(afterDowngrade.isCustom).toBe(false);
    expect(afterDowngrade.displayName).toBe("LearnSynaptic");
  });
});

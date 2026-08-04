import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Business OS Phase 8, Module 8.4 — White Label & Branding. Real,
 * over-HTTP proof (the same discipline every 8.1-8.3 tenant spec in
 * this suite already established) that two real organizations on two
 * real plans get genuinely independent branding: Org A (entitled,
 * configured) sees its own custom identity; Org B (either unentitled
 * or simply unconfigured) sees the default LearnSynaptic experience;
 * neither can read or mutate the other's configuration; unsafe color/
 * URL values are rejected server-side with a real, specific reason.
 */

const ORG_A = "e2e-branding-org-a";
const ORG_B = "e2e-branding-org-b";
const PLATFORM_SECRET = "playwright-test-platform-admin-secret";

async function adminContextFor(browser: import("@playwright/test").Browser, baseURL: string, organizationId: string) {
  const context = await browser.newContext();
  await addSessionCookie(context, baseURL, "admin", {
    id: `e2e-branding-admin-${organizationId}`,
    email: `e2e-branding-admin-${organizationId}@test.local`,
    organizationId,
  });
  return context;
}

test.describe("Module 8.4 — White Label & Branding", () => {
  test("counsellor can read the resolved (applied) branding, but cannot read or write the raw config", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const readResolved = await context.request.get(`${baseURL}/api/admin/branding`);
    expect(readResolved.ok()).toBeTruthy();

    const readConfig = await context.request.get(`${baseURL}/api/admin/branding/config`);
    expect(readConfig.status()).toBe(403);
    const writeConfig = await context.request.put(`${baseURL}/api/admin/branding/config`, { data: { displayName: "Should Fail" } });
    expect(writeConfig.status()).toBe(403);
    await context.close();
  });

  test("manager cannot manage branding either — admin-only, the same tier Integrations already requires", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const writeConfig = await context.request.put(`${baseURL}/api/admin/branding/config`, { data: { displayName: "Should Fail" } });
    expect(writeConfig.status()).toBe(403);
    await context.close();
  });

  test("saving branding for an organization whose plan lacks white_label is rejected server-side, not just hidden in the UI", async ({ browser, baseURL }) => {
    const platformContext = await browser.newContext();
    await addSessionCookie(platformContext, baseURL!, "admin");
    const planResponse = await platformContext.request.post(`${baseURL}/api/admin/billing/plans`, {
      headers: { "x-platform-admin-secret": PLATFORM_SECRET },
      data: {
        id: "e2e-plan-no-white-label",
        name: "No White Label",
        description: "Test.",
        status: "active",
        billingInterval: "monthly",
        currency: "INR",
        basePriceInSmallestUnit: 0,
        capabilities: ["crm"],
        limits: {},
      },
    });
    expect(planResponse.ok()).toBeTruthy();
    await platformContext.close();

    const orgContext = await adminContextFor(browser, baseURL!, "e2e-branding-org-no-wl");
    await orgContext.request.post(`${baseURL}/api/admin/billing/subscription/assign-plan`, { data: { planId: "e2e-plan-no-white-label" } });

    const saveResponse = await orgContext.request.put(`${baseURL}/api/admin/branding/config`, { data: { displayName: "Should Be Rejected" } });
    expect(saveResponse.status()).toBe(403);
    await orgContext.close();
  });

  test("two real organizations, two real distinct brand configurations — real isolation over HTTP, neither ever leaking to the other", async ({ browser, baseURL }) => {
    const platformContext = await browser.newContext();
    await addSessionCookie(platformContext, baseURL!, "admin");
    const planResponse = await platformContext.request.post(`${baseURL}/api/admin/billing/plans`, {
      headers: { "x-platform-admin-secret": PLATFORM_SECRET },
      data: {
        id: "e2e-plan-white-label",
        name: "White Label Plan",
        description: "Test.",
        status: "active",
        billingInterval: "monthly",
        currency: "INR",
        basePriceInSmallestUnit: 0,
        capabilities: ["crm", "white_label", "file_storage"],
        limits: {},
      },
    });
    expect(planResponse.ok()).toBeTruthy();
    await platformContext.close();

    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);

    await orgAContext.request.post(`${baseURL}/api/admin/billing/subscription/assign-plan`, { data: { planId: "e2e-plan-white-label" } });
    await orgBContext.request.post(`${baseURL}/api/admin/billing/subscription/assign-plan`, { data: { planId: "e2e-plan-white-label" } });

    const saveA = await orgAContext.request.put(`${baseURL}/api/admin/branding/config`, {
      data: { displayName: "Org A Brand", accentColor: "#15803d", footerText: "Org A footer text" },
    });
    expect(saveA.ok()).toBeTruthy();

    // Org B deliberately configures a DIFFERENT identity — the isolation
    // proof needs two real, distinguishable configurations, not one
    // configured org and one silent default.
    const saveB = await orgBContext.request.put(`${baseURL}/api/admin/branding/config`, {
      data: { displayName: "Org B Brand", accentColor: "#7c3aed", footerText: "Org B footer text" },
    });
    expect(saveB.ok()).toBeTruthy();

    const resolvedA = await (await orgAContext.request.get(`${baseURL}/api/admin/branding`)).json();
    const resolvedB = await (await orgBContext.request.get(`${baseURL}/api/admin/branding`)).json();
    expect(resolvedA.branding.displayName).toBe("Org A Brand");
    expect(resolvedB.branding.displayName).toBe("Org B Brand");
    expect(resolvedA.branding.cssVariables["--adm-accent"]).toBe("#15803d");
    expect(resolvedB.branding.cssVariables["--adm-accent"]).toBe("#7c3aed");
    // Full response bodies never mention the other organization's own
    // identity in any form.
    expect(JSON.stringify(resolvedA)).not.toContain("Org B Brand");
    expect(JSON.stringify(resolvedB)).not.toContain("Org A Brand");

    // Org B's own raw-config GET is genuinely its own row, never Org A's.
    const configB = await (await orgBContext.request.get(`${baseURL}/api/admin/branding/config`)).json();
    expect(configB.config.displayName).toBe("Org B Brand");
    expect(JSON.stringify(configB)).not.toContain("Org A Brand");

    await orgAContext.close();
    await orgBContext.close();
  });

  test("a logo uploaded by Org A cannot be referenced by Org B's own branding config", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);

    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const uploadResponse = await orgAContext.request.post(`${baseURL}/api/admin/files`, {
      multipart: { file: { name: "org-a-logo.svg", mimeType: "image/svg+xml", buffer: svgBuffer }, category: "ORGANIZATION_ASSET", visibility: "public" },
    });
    expect(uploadResponse.ok()).toBeTruthy();
    const fileId = (await uploadResponse.json()).file.id;

    const crossTenantSave = await orgBContext.request.put(`${baseURL}/api/admin/branding/config`, { data: { logoFileId: fileId } });
    expect(crossTenantSave.status()).toBe(400);

    await orgAContext.close();
    await orgBContext.close();
  });

  test("an unsafe accent color is rejected with a real, specific reason — never silently applied", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const response = await orgAContext.request.put(`${baseURL}/api/admin/branding/config`, { data: { accentColor: "#eeeeee" } });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(JSON.stringify(body)).toMatch(/contrast/i);
    await orgAContext.close();
  });

  test("an unsafe URL scheme (javascript:) for supportUrl is rejected, never stored", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const response = await orgAContext.request.put(`${baseURL}/api/admin/branding/config`, { data: { supportUrl: "javascript:alert(1)" } });
    expect(response.status()).toBe(400);
    await orgAContext.close();
  });

  test("markup in footerText/displayName is rejected outright, never stored for later rendering", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const response = await orgAContext.request.put(`${baseURL}/api/admin/branding/config`, { data: { footerText: "<script>alert(1)</script>" } });
    expect(response.status()).toBe(400);
    await orgAContext.close();
  });

  test("reset removes the configuration entirely — a subsequent read is indistinguishable from never-configured", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const resetResponse = await orgAContext.request.delete(`${baseURL}/api/admin/branding/config`);
    expect(resetResponse.ok()).toBeTruthy();

    const configAfterReset = await (await orgAContext.request.get(`${baseURL}/api/admin/branding/config`)).json();
    expect(configAfterReset.config).toBeNull();
    const resolvedAfterReset = await (await orgAContext.request.get(`${baseURL}/api/admin/branding`)).json();
    expect(resolvedAfterReset.branding.isCustom).toBe(false);
    expect(resolvedAfterReset.branding.displayName).toBe("LearnSynaptic");

    await orgAContext.close();
  });
});

import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Lead Capture — the public entry point into the existing CRM. Verifies
 * both directions the approved plan's own regression requirement calls
 * for: the NEW flow (public form -> real Lead, same lifecycle as any
 * other) and the EXISTING flow (manual/CSV-driven lead creation)
 * remaining completely unaffected by this module's addition.
 */

const ORG_A = `e2e-lcf-org-a-${Date.now()}`;
const ORG_B = `e2e-lcf-org-b-${Date.now()}`;

async function adminContextFor(browser: import("@playwright/test").Browser, baseURL: string, organizationId: string) {
  const context = await browser.newContext();
  await addSessionCookie(context, baseURL, "admin", {
    id: `e2e-admin-${organizationId}`,
    email: `e2e-admin-${organizationId}@test.local`,
    organizationId,
  });
  return context;
}

test.describe("Lead Capture — new public-form flow reaches the real CRM lifecycle", () => {
  test("a real browser submission on the hosted public page creates a Lead visible in the existing Leads API, correctly attributed", async ({
    browser,
    baseURL,
  }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);

    const createRes = await orgAContext.request.post("/api/admin/crm/lead-capture-forms", {
      data: { name: `E2E Website Form ${Date.now()}` },
    });
    expect(createRes.ok()).toBeTruthy();
    const { form } = (await createRes.json()) as { form: { id: string; publicSlug: string; name: string } };
    expect(form.publicSlug).toBeTruthy();

    // A fresh, fully unauthenticated browser context — the real shape of
    // an anonymous visitor opening a shared link, no admin session at all.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/forms/${form.publicSlug}`);
    await expect(publicPage.getByRole("heading", { name: form.name })).toBeVisible();

    const email = `e2e-lcf-${Date.now()}@example.com`;
    await publicPage.locator("#name").fill("E2E Public Visitor");
    await publicPage.locator("#email").fill(email);
    await publicPage.locator("#phone").fill("+919876543212");

    const submitResponse = publicPage.waitForResponse(
      (response) => response.url().includes(`/api/lead-capture/${form.publicSlug}`) && response.request().method() === "POST",
    );
    await publicPage.getByRole("button", { name: /submit/i }).click();
    const response = await submitResponse;
    expect(response.ok()).toBeTruthy();

    // Success state rendered — proves the client read a real 2xx, not
    // just that the request left the browser.
    await expect(publicPage.getByText(/we've received your details|thanks/i)).toBeVisible();
    await publicContext.close();

    // Back as the form's own organization: the lead is real, findable
    // through the exact same admin Leads list every manually-created
    // lead uses, with the correct source/attribution.
    const listRes = await orgAContext.request.get(`/api/admin/leads?search=${encodeURIComponent(email)}`);
    expect(listRes.ok()).toBeTruthy();
    const listBody = (await listRes.json()) as { items: { id: string; source: string; capturedVia?: { formId: string; formName: string } }[] };
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].source).toBe("lead_capture");
    expect(listBody.items[0].capturedVia).toEqual({ formId: form.id, formName: form.name });

    // The form's own submission counters moved.
    const formsRes = await orgAContext.request.get("/api/admin/crm/lead-capture-forms");
    const formsBody = (await formsRes.json()) as { forms: { id: string; submissionCount: number; duplicateCount: number }[] };
    const updated = formsBody.forms.find((f) => f.id === form.id);
    expect(updated?.submissionCount).toBe(1);
    expect(updated?.duplicateCount).toBe(0);

    await orgAContext.close();
  });

  test("an inactive form's public page 404s, and its submission endpoint rejects new leads", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const createRes = await orgAContext.request.post("/api/admin/crm/lead-capture-forms", {
      data: { name: `E2E Paused Form ${Date.now()}` },
    });
    const { form } = (await createRes.json()) as { form: { id: string; publicSlug: string } };
    await orgAContext.request.patch(`/api/admin/crm/lead-capture-forms/${form.id}`, { data: { active: false } });

    const publicContext = await browser.newContext();
    // The page's own "not found" state is determined client-side (see
    // app/forms/[slug]/page.tsx's own doc comment on why) — a real
    // browser page load, not a raw request status code, is what proves
    // it renders correctly.
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/forms/${form.publicSlug}`);
    await expect(publicPage.getByText(/could not be found/i)).toBeVisible();

    const submitRes = await publicContext.request.post(`/api/lead-capture/${form.publicSlug}`, {
      headers: { origin: baseURL! },
      data: { name: "Someone", email: `e2e-inactive-${Date.now()}@example.com`, phone: "+919876543213" },
    });
    expect(submitRes.status()).toBe(404);

    await publicContext.close();
    await orgAContext.close();
  });
});

test.describe("Lead Capture — cross-tenant isolation", () => {
  test("Org B cannot manage Org A's form, and Org A's captured leads never appear in Org B's Leads list", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const createRes = await orgAContext.request.post("/api/admin/crm/lead-capture-forms", {
      data: { name: `E2E Tenant Isolation Form ${Date.now()}` },
    });
    const { form } = (await createRes.json()) as { form: { id: string; publicSlug: string } };

    const email = `e2e-lcf-isolation-${Date.now()}@example.com`;
    const publicContext = await browser.newContext();
    const submitRes = await publicContext.request.post(`/api/lead-capture/${form.publicSlug}`, {
      headers: { origin: baseURL! },
      data: { name: "Isolation Test Lead", email, phone: "+919876543214" },
    });
    expect(submitRes.ok()).toBeTruthy();
    await publicContext.close();

    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);

    // Org B cannot read, update, or delete Org A's form by id — same
    // "behaves like not-found" contract every other tenant-owned
    // resource in this app already guarantees.
    const crossPatch = await orgBContext.request.patch(`/api/admin/crm/lead-capture-forms/${form.id}`, { data: { active: false } });
    expect(crossPatch.status()).toBe(404);

    const crossList = await orgBContext.request.get("/api/admin/crm/lead-capture-forms");
    const crossListBody = (await crossList.json()) as { forms: { id: string }[] };
    expect(crossListBody.forms.find((f) => f.id === form.id)).toBeUndefined();

    // The lead the public submission created is Org A's alone.
    const crossLeadSearch = await orgBContext.request.get(`/api/admin/leads?search=${encodeURIComponent(email)}`);
    const crossLeadBody = (await crossLeadSearch.json()) as { items: unknown[] };
    expect(crossLeadBody.items).toHaveLength(0);

    await orgAContext.close();
    await orgBContext.close();
  });
});

test.describe("Lead Capture — existing manual CRM flow is unaffected", () => {
  test("manually importing a lead via the existing CSV import path still works exactly as before this module", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const email = `e2e-manual-flow-${Date.now()}@example.com`;
    const csv = `name,email,phone\nManual Flow Regression Lead,${email},+919876543215\n`;

    const importRes = await orgAContext.request.post("/api/admin/crm/import?mode=commit", {
      multipart: { file: { name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } },
    });
    expect(importRes.ok()).toBeTruthy();
    const importBody = (await importRes.json()) as { imported: number };
    expect(importBody.imported).toBe(1);

    const listRes = await orgAContext.request.get(`/api/admin/leads?search=${encodeURIComponent(email)}`);
    const listBody = (await listRes.json()) as { items: { source: string; capturedVia?: unknown }[] };
    expect(listBody.items).toHaveLength(1);
    // Untouched by this module: source is whatever the import path always
    // set, and capturedVia is simply absent — never populated for any
    // creation path other than the new public one.
    expect(listBody.items[0].source).toBe("csv-import");
    expect(listBody.items[0].capturedVia).toBeUndefined();

    await orgAContext.close();
  });
});

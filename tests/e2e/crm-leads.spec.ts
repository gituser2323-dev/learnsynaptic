import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

test.describe("CRM — Leads list and detail", () => {
  test("a lead created via the public form is searchable in the admin list and its detail page is editable", async ({
    browser,
    baseURL,
  }) => {
    const managerContext = await browser.newContext();
    await addSessionCookie(managerContext, baseURL!, "manager");

    const uniqueName = `Leads Spec Test ${Date.now()}`;
    const createResponse = await managerContext.request.post("/api/leads", {
      headers: { origin: baseURL! },
      data: {
        name: uniqueName,
        email: `leads-spec-${Date.now()}@example.com`,
        phone: "+919876500010",
        source: "e2e-leads",
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { lead } = await createResponse.json();

    const tagResponse = await managerContext.request.post("/api/admin/crm/tags", {
      data: { label: `e2e-tag-${Date.now()}`, color: "#2d4fd6" },
    });
    expect(tagResponse.ok()).toBeTruthy();
    const { tag } = await tagResponse.json();

    const page = await managerContext.newPage();
    await page.goto("/admin/leads");
    // Scoped to #main-content — the sticky header bar duplicates the
    // page title as its own <h1>, which would otherwise strict-mode
    // violate a page-wide heading lookup.
    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: "Leads" })).toBeVisible();

    await page.getByLabel(/search leads/i).fill(uniqueName);
    await expect(page.getByRole("link", { name: uniqueName })).toBeVisible();

    await page.getByRole("link", { name: uniqueName }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/leads/${lead.id}`));
    await expect(main.getByRole("heading", { name: uniqueName })).toBeVisible();

    await page.getByLabel(/add tag/i).selectOption({ label: tag.label });
    await expect(page.getByRole("button", { name: new RegExp(`${tag.label}`) })).toBeVisible();

    await managerContext.close();
  });
});

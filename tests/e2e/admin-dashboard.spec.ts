import { test, expect } from "@playwright/test";
import { addAdminSessionCookie } from "./helpers";

test.describe("Admin dashboard — authenticated", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await addAdminSessionCookie(context, baseURL!);
  });

  test("an authenticated admin session reaches the dashboard, not the login page", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("WhatsApp Campaigns page loads and the create-campaign form opens", async ({ page }) => {
    await page.goto("/admin/whatsapp");
    await expect(page.getByRole("heading", { name: /whatsapp campaigns/i })).toBeVisible();

    await page.getByRole("button", { name: /new campaign/i }).click();
    await expect(page.getByLabel(/campaign name/i)).toBeVisible();
  });

  test("Settings page loads a read-only configuration snapshot", async ({ page }) => {
    await page.goto("/admin/settings");
    // Scoped to #main-content — the sticky header bar's own <h1> page
    // title duplicates "Settings," which strict-mode violates a
    // page-wide heading lookup. Caught while adding the Phase 1–3 test
    // suite (Module 3.1/3.3 follow-up); this test predates that header
    // pattern and had gone stale without anyone re-running the suite.
    await expect(page.locator("#main-content").getByRole("heading", { name: /settings/i })).toBeVisible();
    await expect(page.getByText(/read-only/i)).toBeVisible();
  });
});

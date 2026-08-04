import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
  test("GET /api/health reports ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("ok");
  });

  test("homepage loads with expected shell", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LearnSynaptic/i);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("register page loads the registration form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("#r-name")).toBeVisible();
    await expect(page.locator("#r-email")).toBeVisible();
  });

  test("admin login page is reachable while unauthenticated", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator("#admin-email")).toBeVisible();
    await expect(page.locator("#admin-password")).toBeVisible();
  });
});

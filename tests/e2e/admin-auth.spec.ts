import { test, expect } from "@playwright/test";

test.describe("Admin auth gate", () => {
  test("visiting a protected admin page while unauthenticated redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("logging in with wrong credentials shows an error, not a false success", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill("nobody@example.com");
    await page.locator("#admin-password").fill("WrongPassword123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Next.js's own route announcer (#__next-route-announcer__) also has
    // role="alert", so scope to the login form's actual error message.
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

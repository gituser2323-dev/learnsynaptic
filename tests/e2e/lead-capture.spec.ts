import { test, expect } from "@playwright/test";

/**
 * RC-1's core fix, verified: submitting the Register page's form must
 * actually reach POST /api/leads and receive a success response — not
 * just show a success screen driven by EmailJS. This is exactly the
 * class of regression (a form that silently stopped reaching its
 * backend) a smoke test exists to catch going forward.
 */
test.describe("Lead capture — backend is the source of truth", () => {
  test("submitting the Register form calls /api/leads and succeeds", async ({ page }) => {
    await page.goto("/register");

    const leadsResponse = page.waitForResponse(
      (response) => response.url().includes("/api/leads") && response.request().method() === "POST",
    );

    await page.locator("#r-name").fill("E2E Test User");
    await page.locator("#r-email").fill(`e2e-${Date.now()}@example.com`);
    await page.locator("#r-phone").fill("+919876543210");
    await page.locator("#r-city").fill("Pune");
    await page.locator("#r-program").selectOption({ label: "AI Beginner Bootcamp (8 weeks)" });
    await page.locator("#r-background").selectOption({ index: 1 });
    await page.locator("#r-goal").fill("Break into an AI engineering role within a year.");

    await page.getByRole("button", { name: /start my path/i }).click();

    const response = await leadsResponse;
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.lead?.id).toBeTruthy();
  });

  test("the Contact page's message form calls /api/leads", async ({ page }) => {
    await page.goto("/contact");

    const leadsResponse = page.waitForResponse(
      (response) => response.url().includes("/api/leads") && response.request().method() === "POST",
    );

    await page.locator("#cf-name").fill("E2E Contact User");
    await page.locator("#cf-email").fill(`e2e-contact-${Date.now()}@example.com`);
    await page.locator("#cf-phone").fill("+919876543211");
    await page.locator("#cf-message").fill("Just checking a few things before I register.");

    await page.getByRole("button", { name: /send message/i }).click();

    const response = await leadsResponse;
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});

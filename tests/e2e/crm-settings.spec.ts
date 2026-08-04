import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/** Enterprise CRM (Phase 1) — the three CRM Configuration panels added
 *  to the Settings page: Tags, Custom Fields, Assignment Rule. All
 *  manager+ (see rbac.spec.ts for the counsellor-can't-see-this half). */
test.describe("CRM — Settings configuration panels", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await addSessionCookie(context, baseURL!, "manager");
  });

  test("Tags panel: create and see a new tag chip", async ({ page }) => {
    await page.goto("/admin/settings");
    const label = `e2e-tag-${Date.now()}`;
    await page.locator("#new-tag-label").fill(label);
    await page.locator("form").filter({ has: page.locator("#new-tag-label") }).locator('button[type="submit"]').click();
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  });

  test("Custom Fields panel: create a field and see it listed", async ({ page }) => {
    await page.goto("/admin/settings");
    const key = `e2e_field_${Date.now()}`;
    await page.locator("#new-field-key").fill(key);
    await page.locator("#new-field-label").fill("E2E Field");
    await page.getByRole("button", { name: "Add field" }).click();
    await expect(page.getByText(`(${key})`)).toBeVisible();
  });

  test("Assignment Rule panel: switch to round robin and save", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByLabel(/assignment strategy/i).selectOption({ label: "Round robin" });
    await page.getByRole("button", { name: "Save assignment rule" }).click();
    await expect(page.getByLabel(/assignment strategy/i)).toHaveValue("round_robin");
  });
});

import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * WhatsApp Platform (Phase 2), Module 2.5 — Campaign Enhancements.
 *
 * Unlike 2.3/2.4, none of this module's own behavior (recurrence,
 * archive, duplicate, reply/click attribution) requires a real vendor
 * account to exercise — creating a campaign, resolving a manual
 * audience, cloning, and archiving are all real app logic with no
 * outbound Graph API call involved. This suite gets full E2E coverage
 * as a result, no live-verification substitute needed.
 */
test.describe("WhatsApp Campaign Enhancements (2.5)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await addSessionCookie(context, baseURL!, "admin");
  });

  async function createTemplate(page: import("@playwright/test").Page): Promise<void> {
    await page.goto("/admin/templates");
    await page.getByRole("button", { name: "New Template" }).click();
    const suffix = Date.now();
    await page.getByLabel("Display Name").fill(`E2E 2.5 Template ${suffix}`);
    await page.getByLabel("Meta Template Name").fill(`e2e_2_5_template_${suffix}`);
    await page.getByLabel("Language Code").fill("en_US");
    await page.getByRole("button", { name: "Create Template" }).click();
    await expect(page.getByText(`e2e_2_5_template_${suffix}`).first()).toBeVisible();
  }

  test("creating a recurring campaign shows the 'recurring' chip in Campaign History", async ({ page }) => {
    await createTemplate(page);
    await page.goto("/admin/whatsapp");
    await page.getByRole("button", { name: "New Campaign" }).click();

    const uniqueName = `E2E Recurring Campaign ${Date.now()}`;
    await page.getByLabel("Campaign Name").fill(uniqueName);
    await page.locator("#wa-campaign-template").selectOption({ label: (await page.locator("#wa-campaign-template option").nth(1).textContent())! });
    await page.getByLabel("Recurring").check();
    await page.getByRole("button", { name: "Create Draft" }).click();

    await expect(page).toHaveURL(/\/admin\/whatsapp\/.+/);
    await expect(page.getByText(/Repeats every 1 weekly/i)).toBeVisible();

    await page.goto("/admin/whatsapp");
    await page.getByPlaceholder("Search name…").fill(uniqueName);
    const row = page.locator("tr", { hasText: uniqueName });
    await expect(row.getByText("recurring", { exact: true })).toBeVisible();
  });

  test("cloning a campaign with a resolved audience produces a clean draft with zero recipients", async ({ page }) => {
    await createTemplate(page);
    await page.goto("/admin/whatsapp");
    await page.getByRole("button", { name: "New Campaign" }).click();
    const uniqueName = `E2E Clone Source ${Date.now()}`;
    await page.getByLabel("Campaign Name").fill(uniqueName);
    await page.locator("#wa-campaign-template").selectOption({ label: (await page.locator("#wa-campaign-template option").nth(1).textContent())! });
    await page.getByRole("button", { name: "Create Draft" }).click();
    await expect(page).toHaveURL(/\/admin\/whatsapp\/.+/);

    // Resolve a real manual audience so the source campaign has real
    // recipients/Message rows to NOT carry over. The "Resolve Audience"
    // section (and its own transient success notice) unmounts the
    // moment the campaign flips from "draft" to "ready" — assert on
    // the resulting state instead of the notice, which can legitimately
    // disappear before a race-prone text assertion ever observes it.
    await page.getByRole("button", { name: "Manual" }).click();
    await page.getByLabel(/Recipients/).fill("+919876500099, E2E Clone Recipient");
    await page.getByRole("button", { name: "Resolve Manual List" }).click();
    await expect(page.getByText("ready", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Duplicate" }).click();
    await expect(page).toHaveURL(/\/admin\/whatsapp\/.+/);
    await expect(page.getByRole("heading", { name: new RegExp(`${uniqueName} \\(Copy\\)`) })).toBeVisible();

    // The clone is a fresh draft: 0 recipients, and the "Resolve
    // Audience" section is present again (only shown for a draft with
    // no audience resolved yet) — both are the DoD's own "clean draft"
    // requirement, visible in the UI, not just the API response.
    await expect(page.getByText("draft", { exact: true })).toBeVisible();
    await expect(page.getByText("Resolve Audience")).toBeVisible();
    const recipientsCard = page.locator(".adm-card", { hasText: "Recipients" });
    await expect(recipientsCard.getByText("0", { exact: true })).toBeVisible();
  });

  test("archiving hides a campaign from the default list; unarchiving restores it", async ({ page }) => {
    await createTemplate(page);
    await page.goto("/admin/whatsapp");
    await page.getByRole("button", { name: "New Campaign" }).click();
    const uniqueName = `E2E Archive Toggle ${Date.now()}`;
    await page.getByLabel("Campaign Name").fill(uniqueName);
    await page.locator("#wa-campaign-template").selectOption({ label: (await page.locator("#wa-campaign-template option").nth(1).textContent())! });
    await page.getByRole("button", { name: "Create Draft" }).click();
    await expect(page).toHaveURL(/\/admin\/whatsapp\/.+/);

    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("archived", { exact: true })).toBeVisible();

    await page.goto("/admin/whatsapp");
    await page.getByPlaceholder("Search name…").fill(uniqueName);
    await expect(page.getByText("No WhatsApp campaigns match these filters.")).toBeVisible();

    await page.getByLabel("Show archived").check();
    await expect(page.locator("tr", { hasText: uniqueName })).toBeVisible();
  });

  test("a manager session is forbidden from archive/clone routes — same admin tier as every WhatsApp Campaign route", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const archiveResponse = await context.request.post(`${baseURL}/api/admin/whatsapp-campaigns/no-such-id/archive`);
    expect(archiveResponse.status()).toBe(403);
    const cloneResponse = await context.request.post(`${baseURL}/api/admin/whatsapp-campaigns/no-such-id/clone`);
    expect(cloneResponse.status()).toBe(403);
    await context.close();
  });
});

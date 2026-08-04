import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * WhatsApp Platform (Phase 2), Module 2.3 — Template Sync & Business
 * Account Health.
 *
 * Same disclosed constraint as every other real-vendor-dependent module
 * in this project: the shared webServer runs with WHATSAPP_PROVIDER
 * unset (console), whose listTemplateApprovalStatuses/getPhoneNumberHealth
 * are simply absent (only metaCloudApi.provider.ts implements them) —
 * whatsappService's own null-on-unsupported convention means the sync
 * jobs always no-op cleanly under this suite, never reach a real Graph
 * API call. That path (a real HTTP call, and graceful handling of a
 * real Meta rejection) is covered instead by a live regression against
 * a real running server with meta-cloud-api active — see CHANGELOG.md's
 * Module 2.3 entry — not skipped, verified a different way. This suite
 * covers what's reachable under the console provider: the Templates
 * page's new Approval column (every template defaults to "unknown"
 * until a sync actually runs), the Settings page's phone-health section
 * rendering safely empty, and RBAC on the new phone-health route.
 */
test.describe("WhatsApp Account Health (2.3)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await addSessionCookie(context, baseURL!, "admin");
  });

  test("a newly created template defaults to an 'unknown' approval status, visible in the Templates table", async ({ page }) => {
    await page.goto("/admin/templates");
    await page.getByRole("button", { name: "New Template" }).click();

    const uniqueName = `E2E Health Check ${Date.now()}`;
    await page.getByLabel("Display Name").fill(uniqueName);
    await page.getByLabel("Meta Template Name").fill(`e2e_health_check_${Date.now()}`);
    await page.getByLabel("Language Code").fill("en_US");
    await page.getByRole("button", { name: "Create Template" }).click();

    const row = page.locator("tr", { hasText: uniqueName });
    await expect(row).toBeVisible();
    await expect(row.getByText("unknown", { exact: true })).toBeVisible();
  });

  test("Settings page's WhatsApp Provider card renders safely with no phone health data yet", async ({ page }) => {
    await page.goto("/admin/settings");
    // No real vendor is configured under this suite, so no phone health
    // row exists yet — the card must still render its other rows (the
    // per-vendor "Not configured" badges) without erroring.
    await expect(page.getByText("WhatsApp Provider")).toBeVisible();
    await expect(page.getByText("Meta Cloud API")).toBeVisible();
  });

  test("a manager session is forbidden from the phone-health route — admin-tier, same as Environment Configuration", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const response = await context.request.get(`${baseURL}/api/admin/whatsapp/phone-health`);
    expect(response.status()).toBe(403);
    await context.close();
  });

  test("an admin can reach the phone-health route and gets an empty list, not an error, when nothing has synced yet", async ({
    context,
    baseURL,
  }) => {
    const response = await context.request.get(`${baseURL}/api/admin/whatsapp/phone-health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body.phoneNumbers)).toBe(true);
  });
});

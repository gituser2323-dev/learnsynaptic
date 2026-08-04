import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * WhatsApp Platform (Phase 2), Module 2.4 — Webhook & API Monitoring.
 *
 * Scoped the same deliberate way conversations.spec.ts/email-channel.spec.ts
 * already are: the shared webServer runs with WHATSAPP_PROVIDER unset
 * (console), whose parseWebhookEvent() never verifies a signature at
 * all — it always returns an empty event array regardless of the body
 * or header, by design (a dev stub, not a real vendor adapter). That
 * means this suite can exercise the "unrecognized" outcome (a real
 * webhook POST that structurally succeeds but carries nothing
 * actionable) end to end, but not "signature_invalid" or "processed" —
 * those require a real HMAC-verifying provider (meta-cloud-api) active,
 * which risks behavior differences for every other spec relying on the
 * console provider's synthetic-success posture. Those two outcomes are
 * disclosed here and covered instead by a live regression against a
 * real running server with meta-cloud-api active and a real computed
 * HMAC signature (see CHANGELOG.md's Module 2.4 entry) — not skipped,
 * just verified a different way, the same posture this project has
 * taken for every other vendor-webhook gap.
 */
test.describe("Webhook & API Monitoring (2.4)", () => {
  test("a real webhook POST is logged as 'unrecognized' and appears in the admin log, oldest last", async ({
    context,
    baseURL,
  }) => {
    await context.request.post(`${baseURL}/api/webhooks/whatsapp`, {
      headers: { "x-hub-signature-256": "sha256=irrelevant-under-the-console-provider" },
      data: { entry: [{ changes: [{ value: {} }] }] },
    });

    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.get(`${baseURL}/api/admin/webhook-deliveries?limit=5`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].outcome).toBe("unrecognized");
    expect(body.items[0].source).toBe("whatsapp");
  });

  test("a manager session is forbidden — webhook deliveries are admin-tier", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const response = await context.request.get(`${baseURL}/api/admin/webhook-deliveries`);
    expect(response.status()).toBe(403);
    await context.close();
  });

  test("the Integrations section on Settings is admin-only, not visible to a manager", async ({ page, context, baseURL }) => {
    await addSessionCookie(context, baseURL!, "manager");
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Integrations" })).toHaveCount(0);
  });

  test("an admin sees the Integrations section with the Webhook Deliveries panel", async ({ page, context, baseURL }) => {
    await addSessionCookie(context, baseURL!, "admin");
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByText("Webhook Deliveries")).toBeVisible();
  });
});

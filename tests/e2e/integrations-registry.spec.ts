import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Integrations Hub (Phase 6), Module 6.1 — Generic Integrations Registry.
 *
 * Unlike Conversations/WhatsApp, every non-builtIn provider here is
 * plain, real app logic (no vendor webhook/signature needed) — the
 * full connect/disconnect/enable/config/logs lifecycle is genuinely
 * reachable in this shared test environment, not scoped around a
 * live-vendor constraint the way 2.x's own specs are.
 */
test.describe("Integrations Registry (6.1)", () => {
  test("a manager session is forbidden — same tier as Webhook Deliveries", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const listResponse = await context.request.get(`${baseURL}/api/admin/integrations`);
    expect(listResponse.status()).toBe(403);
    const connectResponse = await context.request.post(`${baseURL}/api/admin/integrations/zoom/connect`);
    expect(connectResponse.status()).toBe(403);
    await context.close();
  });

  test("an admin sees the Integrations Registry panel on Settings, listing providers across categories", async ({
    page,
    context,
    baseURL,
  }) => {
    await addSessionCookie(context, baseURL!, "admin");
    await page.goto("/admin/settings");
    // Scoped to #main-content — the sidebar nav also has a "WhatsApp"
    // link, which would otherwise strict-mode-violate an unscoped lookup.
    const main = page.locator("#main-content");
    await expect(main.getByText("Provider Registry")).toBeVisible();
    await expect(main.getByText("WhatsApp", { exact: true })).toBeVisible();
    await expect(main.getByText("Managed via environment configuration").first()).toBeVisible();
  });

  test("full connect → configure → disable → enable → disconnect → reconnect lifecycle over real HTTP", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");

    const connectResponse = await context.request.post(`${baseURL}/api/admin/integrations/razorpay/connect`, {
      data: { config: { displayName: "Primary Razorpay account" } },
    });
    expect(connectResponse.ok()).toBeTruthy();
    const connectBody = await connectResponse.json();
    expect(connectBody.integration.status).toBe("connected");
    expect(connectBody.integration.enabled).toBe(true);

    const configResponse = await context.request.put(`${baseURL}/api/admin/integrations/razorpay/config`, {
      data: { config: { displayName: "Renamed account" } },
    });
    expect(configResponse.ok()).toBeTruthy();
    expect((await configResponse.json()).integration.config.displayName).toBe("Renamed account");

    const disableResponse = await context.request.patch(`${baseURL}/api/admin/integrations/razorpay/enabled`, {
      data: { enabled: false },
    });
    expect(disableResponse.ok()).toBeTruthy();
    expect((await disableResponse.json()).integration.enabled).toBe(false);

    const enableResponse = await context.request.patch(`${baseURL}/api/admin/integrations/razorpay/enabled`, {
      data: { enabled: true },
    });
    expect((await enableResponse.json()).integration.enabled).toBe(true);

    const disconnectResponse = await context.request.post(`${baseURL}/api/admin/integrations/razorpay/disconnect`);
    expect(disconnectResponse.ok()).toBeTruthy();
    expect((await disconnectResponse.json()).integration.status).toBe("disconnected");

    const reconnectResponse = await context.request.post(`${baseURL}/api/admin/integrations/razorpay/connect`);
    expect(reconnectResponse.ok()).toBeTruthy();
    expect((await reconnectResponse.json()).integration.status).toBe("connected");

    const logsResponse = await context.request.get(`${baseURL}/api/admin/integrations/razorpay/logs`);
    expect(logsResponse.ok()).toBeTruthy();
    const logsBody = await logsResponse.json();
    expect(logsBody.total).toBeGreaterThanOrEqual(4);

    await context.close();
  });

  test("rejects connecting a builtIn provider (WhatsApp/Email/AI are managed via env config, not this registry)", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.post(`${baseURL}/api/admin/integrations/whatsapp/connect`);
    expect(response.status()).toBe(400);
    await context.close();
  });

  test("rejects a config with a credential-shaped key", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.post(`${baseURL}/api/admin/integrations/stripe/connect`, {
      data: { config: { apiSecret: "sk_test_leaked" } },
    });
    expect(response.status()).toBe(400);
    await context.close();
  });

  test("404s for an unknown provider id", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.get(`${baseURL}/api/admin/integrations/not-a-real-provider`);
    expect(response.status()).toBe(404);
    await context.close();
  });
});

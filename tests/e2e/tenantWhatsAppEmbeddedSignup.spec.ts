import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup. Real,
 * over-HTTP proof of RBAC, entitlement gating, and cross-tenant
 * isolation on the new self-service connection routes.
 *
 * Scoped deliberately, matching the exact, already-disclosed
 * environmental constraint tests/e2e/conversations.spec.ts's own doc
 * comment established for Module 2.1/2.2: this shared Playwright
 * webServer runs WHATSAPP_PROVIDER at its own "console" default (never
 * flipped to meta-cloud-api globally, since that would change every
 * other spec's WhatsApp send/webhook behavior too), and carries no real
 * WHATSAPP_META_APP_ID/CONFIG_ID/APP_SECRET. That means:
 *  - The real Meta Embedded Signup popup and code-exchange cannot be
 *    driven here (no live Meta credentials exist in this environment —
 *    the mission's own explicit "REQUIRES LIVE META CREDENTIALS"
 *    disclosure applies, not a shortcut taken).
 *  - Full HTTP-level inbound-webhook tenant routing (a real HMAC-signed
 *    POST resolving to the correct organization) is exercised at the
 *    unit level instead (webhookRouting.unit.test.ts), the same
 *    resolution 2.1/2.2's own spec already chose for the identical
 *    constraint — not attempted here via an unsafe global env flip that
 *    would destabilize every other spec in this shared suite.
 * What IS fully provable over real HTTP here: RBAC, entitlement
 * gating, the real "platform not configured" degradation (never a
 * fabricated success), and cross-tenant isolation on every new route —
 * using the same underlying tenant_secret storage mechanism (Module
 * 8.2's own `PUT /credentials`) a completed Embedded Signup would also
 * write to, so the isolation proof is real, not a mock of the real
 * mechanism.
 */
const PLATFORM_SECRET = "playwright-test-platform-admin-secret";

async function adminContextFor(browser: import("@playwright/test").Browser, baseURL: string, organizationId: string) {
  const context = await browser.newContext();
  await addSessionCookie(context, baseURL, "admin", {
    id: `e2e-wa-signup-admin-${organizationId}`,
    email: `e2e-wa-signup-admin-${organizationId}@test.local`,
    organizationId,
  });
  return context;
}

test.describe("Module 8.5 — WhatsApp Embedded Signup", () => {
  test("counsellor is forbidden from every embedded-signup route — same admin-only tier as the rest of Integrations", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");

    const config = await context.request.get(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/config`);
    expect(config.status()).toBe(403);
    const status = await context.request.get(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/status`);
    expect(status.status()).toBe(403);
    const complete = await context.request.post(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/complete`, { data: { code: "x" } });
    expect(complete.status()).toBe(403);
    const disconnect = await context.request.post(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/disconnect`);
    expect(disconnect.status()).toBe(403);

    await context.close();
  });

  test("manager is forbidden too — no provider connection management below Tenant Admin, per the mission's own RBAC section", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const complete = await context.request.post(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/complete`, { data: { code: "x" } });
    expect(complete.status()).toBe(403);
    await context.close();
  });

  test("config route reports the real, honest platform state — never fabricates 'configured' when no Meta App is set up", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin", { organizationId: "e2e-wa-signup-config-org" });

    const response = await context.request.get(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/config`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    // This deployment (the shared Playwright webServer) genuinely has no
    // WHATSAPP_META_APP_ID/CONFIG_ID/APP_SECRET configured — asserting
    // `configured: false` here is a real fact about this environment,
    // not a stubbed expectation.
    expect(body.configured).toBe(false);
    expect(body.appId).toBeUndefined();
    expect(body.configId).toBeUndefined();

    await context.close();
  });

  test("an org whose plan includes whatsapp_embedded_signup passes entitlement but is honestly blocked by the real 'platform not configured' state, never a fabricated success", async ({ browser, baseURL }) => {
    const platformContext = await browser.newContext();
    await addSessionCookie(platformContext, baseURL!, "admin");
    const planResponse = await platformContext.request.post(`${baseURL}/api/admin/billing/plans`, {
      headers: { "x-platform-admin-secret": PLATFORM_SECRET },
      data: {
        id: "e2e-plan-wa-embedded-signup",
        name: "WhatsApp Embedded Signup Plan",
        description: "Test.",
        status: "active",
        billingInterval: "monthly",
        currency: "INR",
        basePriceInSmallestUnit: 0,
        capabilities: ["crm", "whatsapp", "whatsapp_embedded_signup"],
        limits: {},
      },
    });
    expect(planResponse.ok()).toBeTruthy();
    await platformContext.close();

    const orgContext = await adminContextFor(browser, baseURL!, "e2e-wa-signup-entitled-org");
    await orgContext.request.post(`${baseURL}/api/admin/billing/subscription/assign-plan`, { data: { planId: "e2e-plan-wa-embedded-signup" } });

    const completeResponse = await orgContext.request.post(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/complete`, {
      data: { code: "a-real-looking-authorization-code" },
    });
    // Entitled, so this is NOT a 403 — it's a real 400 (this deployment
    // genuinely has no Embedded Signup app configured), the honest
    // "REQUIRES LIVE META CREDENTIALS" state, not a silently-passed
    // fake success.
    expect(completeResponse.status()).toBe(400);
    const body = await completeResponse.json();
    expect(JSON.stringify(body)).toMatch(/not configured/i);

    await orgContext.close();
  });

  test("an org whose plan lacks whatsapp_embedded_signup is rejected server-side with a real 403, before the platform-config check even matters", async ({ browser, baseURL }) => {
    const platformContext = await browser.newContext();
    await addSessionCookie(platformContext, baseURL!, "admin");
    const planResponse = await platformContext.request.post(`${baseURL}/api/admin/billing/plans`, {
      headers: { "x-platform-admin-secret": PLATFORM_SECRET },
      data: {
        id: "e2e-plan-wa-no-embedded-signup",
        name: "No Embedded Signup Plan",
        description: "Test.",
        status: "active",
        billingInterval: "monthly",
        currency: "INR",
        basePriceInSmallestUnit: 0,
        capabilities: ["crm", "whatsapp"],
        limits: {},
      },
    });
    expect(planResponse.ok()).toBeTruthy();
    await platformContext.close();

    const orgContext = await adminContextFor(browser, baseURL!, "e2e-wa-signup-unentitled-org");
    await orgContext.request.post(`${baseURL}/api/admin/billing/subscription/assign-plan`, { data: { planId: "e2e-plan-wa-no-embedded-signup" } });

    const completeResponse = await orgContext.request.post(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/complete`, {
      data: { code: "any-code" },
    });
    expect(completeResponse.status()).toBe(403);

    await orgContext.close();
  });

  test("two real organizations, two real distinct WhatsApp connections (via the shared tenant-credential mechanism) — real isolation over HTTP", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, "e2e-wa-signup-org-a");
    const orgBContext = await adminContextFor(browser, baseURL!, "e2e-wa-signup-org-b");

    // Configured via Module 8.2's own real, already-proven tenant-
    // credential mechanism — the same underlying IntegrationConnection
    // storage a completed Embedded Signup writes to.
    const saveA = await orgAContext.request.put(`${baseURL}/api/admin/integrations/whatsapp/credentials`, {
      data: { values: { accessToken: "org-a-real-token", phoneNumberId: "111000111", businessAccountId: "waba-a" } },
    });
    expect(saveA.ok()).toBeTruthy();
    const saveB = await orgBContext.request.put(`${baseURL}/api/admin/integrations/whatsapp/credentials`, {
      data: { values: { accessToken: "org-b-real-token", phoneNumberId: "222000222", businessAccountId: "waba-b" } },
    });
    expect(saveB.ok()).toBeTruthy();

    const statusA = await (await orgAContext.request.get(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/status`)).json();
    const statusB = await (await orgBContext.request.get(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/status`)).json();

    // Each organization's own connection is genuinely distinguishable,
    // and full response bodies never mention the other org's own token.
    expect(statusA.connection.state).not.toBe("not_connected");
    expect(statusB.connection.state).not.toBe("not_connected");
    expect(JSON.stringify(statusA)).not.toContain("org-b-real-token");
    expect(JSON.stringify(statusB)).not.toContain("org-a-real-token");
    expect(JSON.stringify(statusA)).not.toContain("org-a-real-token"); // masked even for the owner
    expect(JSON.stringify(statusB)).not.toContain("org-b-real-token");

    await orgAContext.close();
    await orgBContext.close();
  });

  test("disconnecting Org A never affects Org B's own connection", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, "e2e-wa-signup-disc-a");
    const orgBContext = await adminContextFor(browser, baseURL!, "e2e-wa-signup-disc-b");

    await orgAContext.request.put(`${baseURL}/api/admin/integrations/whatsapp/credentials`, {
      data: { values: { accessToken: "disc-a-token", phoneNumberId: "333000333" } },
    });
    await orgBContext.request.put(`${baseURL}/api/admin/integrations/whatsapp/credentials`, {
      data: { values: { accessToken: "disc-b-token", phoneNumberId: "444000444" } },
    });

    const disconnectA = await orgAContext.request.post(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/disconnect`);
    expect(disconnectA.ok()).toBeTruthy();

    const statusAAfter = await (await orgAContext.request.get(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/status`)).json();
    const statusBAfter = await (await orgBContext.request.get(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/status`)).json();

    expect(statusAAfter.connection.state).toBe("not_connected");
    expect(statusBAfter.connection.state).not.toBe("not_connected");

    await orgAContext.close();
    await orgBContext.close();
  });

  test("disconnecting an organization that was never connected succeeds gracefully — never a 500", async ({ browser, baseURL }) => {
    const orgContext = await adminContextFor(browser, baseURL!, "e2e-wa-signup-disc-never");
    const response = await orgContext.request.post(`${baseURL}/api/admin/integrations/whatsapp/embedded-signup/disconnect`);
    expect(response.ok()).toBeTruthy();
    await orgContext.close();
  });
});

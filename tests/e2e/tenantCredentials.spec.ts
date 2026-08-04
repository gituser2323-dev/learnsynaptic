import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Business OS Phase 8, Module 8.2 — Tenant Context & Credentials. Real,
 * over-HTTP proof (not just unit tests — same discipline
 * tenantIsolation.spec.ts already established for 8.1) that:
 *  - a Manager session cannot manage tenant credentials (RBAC),
 *  - Org A and Org B each resolve only their OWN configured provider
 *    credentials, never each other's,
 *  - the raw credential value never appears anywhere in an API JSON
 *    response — only masked placeholders and (for the log endpoint)
 *    key names.
 */

const ORG_A = "e2e-cred-org-a";
const ORG_B = "e2e-cred-org-b";

async function adminContextFor(browser: import("@playwright/test").Browser, baseURL: string, organizationId: string) {
  const context = await browser.newContext();
  await addSessionCookie(context, baseURL, "admin", {
    id: `e2e-cred-admin-${organizationId}`,
    email: `e2e-cred-admin-${organizationId}@test.local`,
    organizationId,
  });
  return context;
}

test.describe("Module 8.2 — Tenant Credentials", () => {
  test("a manager session is forbidden from setting or clearing credentials", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const setResponse = await context.request.put(`${baseURL}/api/admin/integrations/openai/credentials`, {
      data: { values: { apiKey: "should-be-forbidden" } },
    });
    expect(setResponse.status()).toBe(403);
    const clearResponse = await context.request.delete(`${baseURL}/api/admin/integrations/openai/credentials`);
    expect(clearResponse.status()).toBe(403);
    await context.close();
  });

  test("rejects an empty values object and non-string values", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const empty = await context.request.put(`${baseURL}/api/admin/integrations/discord/credentials`, { data: { values: {} } });
    expect(empty.status()).toBe(400);
    const nonString = await context.request.put(`${baseURL}/api/admin/integrations/discord/credentials`, { data: { values: { apiKey: 12345 } } });
    expect(nonString.status()).toBe(400);
    await context.close();
  });

  test("404s for an unknown provider id", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.put(`${baseURL}/api/admin/integrations/not-a-real-provider/credentials`, {
      data: { values: { apiKey: "x" } },
    });
    expect(response.status()).toBe(404);
    await context.close();
  });

  test("sets tenant credentials for a builtIn provider (AI) — allowed, unlike plain connect()", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");

    const response = await context.request.put(`${baseURL}/api/admin/integrations/anthropic/credentials`, {
      data: { values: { apiKey: "sk-ant-super-secret-e2e-value" } },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.integration.credentialRef.type).toBe("tenant_secret");

    // The raw secret must never appear anywhere in the response body.
    expect(JSON.stringify(body)).not.toContain("sk-ant-super-secret-e2e-value");
    expect(body.integration.credentialRef.encryptedValues.apiKey).toBe("••••••••");

    await context.close();
  });

  test("clears tenant credentials, reverting a builtIn provider back to reporting env config", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");

    await context.request.put(`${baseURL}/api/admin/integrations/gemini/credentials`, { data: { values: { apiKey: "temp-value" } } });
    const cleared = await context.request.delete(`${baseURL}/api/admin/integrations/gemini/credentials`);
    expect(cleared.ok()).toBeTruthy();
    expect((await cleared.json()).integration.credentialRef.type).toBe("env");

    // A second clear on an already-cleared provider is a real client error.
    const secondClear = await context.request.delete(`${baseURL}/api/admin/integrations/gemini/credentials`);
    expect(secondClear.status()).toBe(400);

    await context.close();
  });

  test("cross-tenant isolation: Org A's credential is invisible to Org B over real HTTP", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);

    const setResponse = await orgAContext.request.put(`${baseURL}/api/admin/integrations/slack/credentials`, {
      data: { values: { webhookSecret: "org-a-only-secret-e2e" } },
    });
    expect(setResponse.ok()).toBeTruthy();

    // Org A sees its own configured credential.
    const orgAGet = await orgAContext.request.get(`${baseURL}/api/admin/integrations/slack`);
    expect((await orgAGet.json()).integration.credentialRef.type).toBe("tenant_secret");

    // Org B, a completely different admin session, sees this provider
    // as never-connected — not Org A's tenant_secret, and no way to
    // read Org A's masked value either.
    const orgBGet = await orgBContext.request.get(`${baseURL}/api/admin/integrations/slack`);
    const orgBBody = await orgBGet.json();
    expect(orgBBody.integration.status).toBe("disconnected");
    expect(orgBBody.integration.credentialRef).toEqual({ type: "none" });

    // Org B clearing a credential it never configured is a real
    // not_connected error, not a silent success and not Org A's data.
    const orgBClear = await orgBContext.request.delete(`${baseURL}/api/admin/integrations/slack/credentials`);
    expect(orgBClear.status()).toBe(400);

    // Full response bodies from Org B's perspective never contain Org
    // A's secret value in any form.
    expect(JSON.stringify(orgBBody)).not.toContain("org-a-only-secret-e2e");

    await orgAContext.close();
    await orgBContext.close();
  });

  test("logs record only key names, never the credential value", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");

    await context.request.put(`${baseURL}/api/admin/integrations/microsoft_teams/credentials`, {
      data: { values: { webhookSecret: "e2e-log-leak-check-value" } },
    });
    const logsResponse = await context.request.get(`${baseURL}/api/admin/integrations/microsoft_teams/logs`);
    expect(logsResponse.ok()).toBeTruthy();
    const logsBody = await logsResponse.json();
    expect(JSON.stringify(logsBody)).not.toContain("e2e-log-leak-check-value");
    expect(JSON.stringify(logsBody)).toContain("webhookSecret");

    await context.close();
  });
});

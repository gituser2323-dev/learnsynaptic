import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Business OS Phase 8, Module 8.3 — Billing, Plans & Feature Flags.
 * Real, over-HTTP proof (not just unit tests — the same discipline
 * tenantIsolation.spec.ts/tenantCredentials.spec.ts already
 * established for 8.1/8.2) that two real organizations on two real,
 * different plans get genuinely independent, server-enforced
 * entitlements: an allowed feature works, a blocked one is rejected
 * with a real 403, a usage limit is rejected with a real 402, and
 * neither organization's billing state is ever visible to the other.
 */

const ORG_A = "e2e-billing-org-a";
const ORG_B = "e2e-billing-org-b";
const PLATFORM_SECRET = "playwright-test-platform-admin-secret";

async function adminContextFor(browser: import("@playwright/test").Browser, baseURL: string, organizationId: string) {
  const context = await browser.newContext();
  await addSessionCookie(context, baseURL, "admin", {
    id: `e2e-billing-admin-${organizationId}`,
    email: `e2e-billing-admin-${organizationId}@test.local`,
    organizationId,
  });
  return context;
}

test.describe("Module 8.3 — Billing, Plans & Feature Flags", () => {
  test("plan-catalog write route: role gate fires before the platform secret is even checked", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const response = await context.request.post(`${baseURL}/api/admin/billing/plans`, {
      headers: { "x-platform-admin-secret": PLATFORM_SECRET },
      data: { id: "e2e-should-not-exist", name: "X", description: "X", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 0, capabilities: [], limits: {} },
    });
    expect(response.status()).toBe(403);
    await context.close();
  });

  test("plan-catalog write route: an admin session without the platform secret is rejected", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.post(`${baseURL}/api/admin/billing/plans`, {
      data: { id: "e2e-should-not-exist-2", name: "X", description: "X", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 0, capabilities: [], limits: {} },
    });
    expect(response.status()).toBe(403);
    await context.close();
  });

  test("two real plans created via the platform-secret-gated route, then assigned to two real organizations", async ({ browser, baseURL }) => {
    const platformContext = await browser.newContext();
    await addSessionCookie(platformContext, baseURL!, "admin");

    const planAResponse = await platformContext.request.post(`${baseURL}/api/admin/billing/plans`, {
      headers: { "x-platform-admin-secret": PLATFORM_SECRET },
      data: {
        id: "e2e-plan-a",
        name: "E2E Plan A",
        description: "Limited plan for E2E isolation testing.",
        status: "active",
        billingInterval: "monthly",
        currency: "INR",
        basePriceInSmallestUnit: 0,
        capabilities: ["crm", "file_storage"],
        limits: { storage_bytes: 10 },
      },
    });
    expect(planAResponse.ok()).toBeTruthy();

    const planBResponse = await platformContext.request.post(`${baseURL}/api/admin/billing/plans`, {
      headers: { "x-platform-admin-secret": PLATFORM_SECRET },
      data: {
        id: "e2e-plan-b",
        name: "E2E Plan B",
        description: "Expanded plan for E2E isolation testing.",
        status: "active",
        billingInterval: "monthly",
        currency: "INR",
        basePriceInSmallestUnit: 0,
        capabilities: ["crm", "whatsapp_campaigns", "file_storage"],
        limits: { storage_bytes: 10_000_000 },
      },
    });
    expect(planBResponse.ok()).toBeTruthy();
    await platformContext.close();

    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);

    const assignA = await orgAContext.request.post(`${baseURL}/api/admin/billing/subscription/assign-plan`, { data: { planId: "e2e-plan-a" } });
    expect(assignA.ok()).toBeTruthy();
    const assignB = await orgBContext.request.post(`${baseURL}/api/admin/billing/subscription/assign-plan`, { data: { planId: "e2e-plan-b" } });
    expect(assignB.ok()).toBeTruthy();

    const subA = await (await orgAContext.request.get(`${baseURL}/api/admin/billing/subscription`)).json();
    const subB = await (await orgBContext.request.get(`${baseURL}/api/admin/billing/subscription`)).json();
    expect(subA.plan.id).toBe("e2e-plan-a");
    expect(subB.plan.id).toBe("e2e-plan-b");
    // Org A's own subscription response never contains anything about
    // Org B's plan, and vice versa — real tenant isolation, not merely
    // "each queried the right plan id."
    expect(JSON.stringify(subA)).not.toContain("e2e-plan-b");
    expect(JSON.stringify(subB)).not.toContain("e2e-plan-a");

    await orgAContext.close();
    await orgBContext.close();
  });

  test("allowed vs. blocked feature: Org B (has whatsapp_campaigns) can create a campaign; Org A (does not) is rejected with a real 403", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);

    const blocked = await orgAContext.request.post(`${baseURL}/api/admin/whatsapp-campaigns`, {
      data: { name: "Org A campaign attempt", audienceSource: { type: "tag", tag: "test" }, templatePayload: { templateName: "x", languageCode: "en", variables: [] } },
    });
    expect(blocked.status()).toBe(403);

    const allowed = await orgBContext.request.post(`${baseURL}/api/admin/whatsapp-campaigns`, {
      data: { name: "Org B campaign", audienceSource: { type: "tag", tag: "test" }, templatePayload: { templateName: "x", languageCode: "en", variables: [] } },
    });
    // Not necessarily a clean 201 (audience resolution may legitimately
    // fail for an unseeded tag) — the point is it must NOT be a 403
    // capability rejection, proving Org B's own plan really does grant
    // this feature over real HTTP.
    expect(allowed.status()).not.toBe(403);

    await orgAContext.close();
    await orgBContext.close();
  });

  test("usage limit: Org A's tiny storage limit rejects an upload with a real 402, never partially creating a file", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);

    const beforeList = await (await orgAContext.request.get(`${baseURL}/api/admin/files`)).json();
    const beforeCount = beforeList.total ?? beforeList.items?.length ?? 0;

    const buffer = Buffer.from("this file is bigger than the 10-byte org A storage limit");
    const response = await orgAContext.request.post(`${baseURL}/api/admin/files`, {
      multipart: {
        file: { name: "too-big.txt", mimeType: "text/plain", buffer },
        category: "OTHER",
        visibility: "private",
      },
    });
    expect(response.status()).toBe(402);

    const afterList = await (await orgAContext.request.get(`${baseURL}/api/admin/files`)).json();
    const afterCount = afterList.total ?? afterList.items?.length ?? 0;
    // The rejected upload never partially created a FileAsset row.
    expect(afterCount).toBe(beforeCount);

    await orgAContext.close();
  });

  test("cancelling Org B's subscription immediately revokes its own whatsapp_campaigns capability, without touching Org A", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);

    const cancelResponse = await orgBContext.request.post(`${baseURL}/api/admin/billing/subscription/cancel`, { data: { immediate: true } });
    expect(cancelResponse.ok()).toBeTruthy();
    expect((await cancelResponse.json()).subscription.status).toBe("cancelled");

    const nowBlocked = await orgBContext.request.post(`${baseURL}/api/admin/whatsapp-campaigns`, {
      data: { name: "Org B post-cancel attempt", audienceSource: { type: "tag", tag: "test" }, templatePayload: { templateName: "x", languageCode: "en", variables: [] } },
    });
    expect(nowBlocked.status()).toBe(403);

    // Org A's own subscription is completely unaffected by Org B
    // cancelling.
    const subA = await (await orgAContext.request.get(`${baseURL}/api/admin/billing/subscription`)).json();
    expect(subA.subscription.status).not.toBe("cancelled");

    await orgAContext.close();
    await orgBContext.close();
  });

  test("counsellor cannot view billing/usage; manager can view but not mutate", async ({ browser, baseURL }) => {
    const counsellorContext = await browser.newContext();
    await addSessionCookie(counsellorContext, baseURL!, "counsellor");
    const counsellorResponse = await counsellorContext.request.get(`${baseURL}/api/admin/billing/subscription`);
    expect(counsellorResponse.status()).toBe(403);
    await counsellorContext.close();

    const managerContext = await browser.newContext();
    await addSessionCookie(managerContext, baseURL!, "manager");
    const managerRead = await managerContext.request.get(`${baseURL}/api/admin/billing/subscription`);
    expect(managerRead.ok()).toBeTruthy();
    const managerMutate = await managerContext.request.post(`${baseURL}/api/admin/billing/subscription/assign-plan`, { data: { planId: "e2e-plan-a" } });
    expect(managerMutate.status()).toBe(403);
    await managerContext.close();
  });
});

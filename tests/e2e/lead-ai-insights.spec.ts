import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * AI CRM (Phase 5), Module 5.1 — AI Lead Scoring & Insights.
 *
 * This shared webServer runs with no AI_PROVIDER/API key configured
 * (see .env.example) — exactly the "fail gracefully" case the module's
 * own Quality Gate calls out, so this suite covers that path for real,
 * not the "a real vendor scored this lead" path, which needs a real
 * key and is live-verified separately (see the module's own
 * CHANGELOG entry).
 */
test.describe("AI Lead Insights (5.1)", () => {
  test("shows 'no analysis yet', then degrades gracefully to 'unavailable' after Analyze Now — no AI provider configured", async ({
    browser,
    baseURL,
  }) => {
    const managerContext = await browser.newContext();
    await addSessionCookie(managerContext, baseURL!, "manager");

    const uniqueName = `AI Insights Spec Lead ${Date.now()}`;
    const createResponse = await managerContext.request.post("/api/leads", {
      headers: { origin: baseURL! },
      data: {
        name: uniqueName,
        email: `ai-insights-spec-${Date.now()}@example.com`,
        phone: "+919876500055",
        source: "e2e-ai-insights",
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { lead } = await createResponse.json();

    const page = await managerContext.newPage();
    await page.goto(`/admin/leads/${lead.id}`);

    await expect(page.getByText("No AI analysis yet for this lead.")).toBeVisible();
    await page.getByRole("button", { name: "Analyze Now" }).click();

    await expect(page.getByText("AI insights are unavailable: no AI provider is configured for this environment.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Analyze Again" })).toBeVisible();

    await managerContext.close();
  });

  test("a counsellor not assigned to the lead is forbidden from viewing or triggering its AI insights", async ({ browser, baseURL }) => {
    const managerContext = await browser.newContext();
    await addSessionCookie(managerContext, baseURL!, "manager");
    const createResponse = await managerContext.request.post("/api/leads", {
      headers: { origin: baseURL! },
      data: {
        name: `AI Insights RBAC Lead ${Date.now()}`,
        email: `ai-insights-rbac-${Date.now()}@example.com`,
        phone: "+919876500056",
        source: "e2e-ai-insights",
      },
    });
    const { lead } = await createResponse.json();
    await managerContext.close();

    const counsellorContext = await browser.newContext();
    await addSessionCookie(counsellorContext, baseURL!, "counsellor");
    const getResponse = await counsellorContext.request.get(`/api/admin/leads/${lead.id}/insights`);
    expect(getResponse.status()).toBe(403);
    const postResponse = await counsellorContext.request.post(`/api/admin/leads/${lead.id}/insights`);
    expect(postResponse.status()).toBe(403);
    await counsellorContext.close();
  });
});

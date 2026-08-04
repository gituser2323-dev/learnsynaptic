import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Enterprise CRM (Phase 1), Module 1.5 — Sales Pipeline & Opportunities.
 * Stage-to-stage movement is native HTML5 drag-and-drop with no
 * button/keyboard alternative in the UI itself — deliberately not
 * covered here (a drag simulation would be testing Playwright's DnD
 * emulation more than this app's own logic); creation onto the default
 * pipeline is the high-value path this covers instead.
 */
test.describe("CRM — Sales Pipeline", () => {
  test("manager can create an Opportunity for a lead and see it on the board", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");

    const leadResponse = await context.request.post("/api/leads", {
      headers: { origin: baseURL! },
      data: {
        name: "Pipeline Spec Lead",
        email: `pipeline-spec-${Date.now()}@example.com`,
        phone: "+919876500020",
        source: "e2e-pipeline",
      },
    });
    expect(leadResponse.ok()).toBeTruthy();
    const { lead } = await leadResponse.json();

    const page = await context.newPage();
    await page.goto("/admin/pipeline");
    // Scoped to #main-content — the sticky header bar duplicates the
    // page title as its own <h1>.
    await expect(page.locator("#main-content").getByRole("heading", { name: "Pipeline" })).toBeVisible();

    await page.getByRole("button", { name: "New Opportunity" }).click();
    await page.locator("#opp-lead-id").fill(lead.id);
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText(new RegExp(lead.id.slice(-6)))).toBeVisible();
    await context.close();
  });
});

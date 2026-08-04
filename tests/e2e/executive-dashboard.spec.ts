import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Enterprise Analytics (Phase 7), module 7.3 — Executive Dashboard.
 * Covers the flagship /admin/executive page (KPI Layer, Revenue
 * Overview, Sales Funnel, Counsellor/Campaign Performance, WhatsApp/
 * Automation/Payment Health) and its Action Center, plus RBAC for both
 * new routes (/api/admin/executive/dashboard,
 * /api/admin/executive/action-center) — both gated `requiredRole:
 * "admin"`, the same tier /api/admin/analytics/revenue (Module 7.2)
 * already established for account-wide revenue payloads.
 */
test.describe("Executive Dashboard (Module 7.3)", () => {
  test("an admin session sees every dashboard section render with real data", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const page = await context.newPage();
    await page.goto("/admin/executive");

    await expect(page.locator("#main-content").getByRole("heading", { name: "Executive Dashboard" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Needs Attention" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Executive KPIs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revenue Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sales Funnel" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Counsellor Performance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Campaign Performance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "WhatsApp Health" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Automation Health" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payment Health" })).toBeVisible();

    // Real KPI tiles, not an error/empty state.
    await expect(page.getByText("Total Leads")).toBeVisible();
    await expect(page.getByText("Collected Revenue").first()).toBeVisible();

    // No error state anywhere on the page.
    await expect(page.getByText(/could not load/i)).toHaveCount(0);

    await context.close();
  });

  test("date range preset change re-fetches the dashboard without an error state", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const page = await context.newPage();
    await page.goto("/admin/executive");
    await expect(page.getByRole("heading", { name: "Executive KPIs" })).toBeVisible();

    await page.getByRole("group", { name: "Date range preset" }).getByRole("button", { name: "Last 7 Days" }).click();
    await expect(page.getByRole("heading", { name: "Executive KPIs" })).toBeVisible();
    await expect(page.getByText(/could not load/i)).toHaveCount(0);

    await context.close();
  });

  test("Action Center category cards, when present, link to the real owning page", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const page = await context.newPage();
    await page.goto("/admin/executive");
    await expect(page.getByRole("heading", { name: "Needs Attention" })).toBeVisible();

    const overdueTasksCard = page.getByRole("link", { name: /overdue tasks/i });
    if (await overdueTasksCard.count() > 0) {
      await expect(overdueTasksCard).toHaveAttribute("href", "/admin/tasks");
    } else {
      await expect(page.getByText(/nothing needs attention right now/i)).toBeVisible();
    }

    await context.close();
  });

  test("manager and counsellor sessions are forbidden — this dashboard is admin-only like Module 7.2's own revenue payload", async ({
    browser,
    baseURL,
  }) => {
    for (const role of ["manager", "counsellor"] as const) {
      const context = await browser.newContext();
      await addSessionCookie(context, baseURL!, role);
      const page = await context.newPage();
      await page.goto("/admin/executive");
      await expect(page.getByText(/you don't have permission to view this/i).first()).toBeVisible();
      await context.close();
    }
  });

  test("both new routes enforce RBAC over real HTTP: 401 unauthenticated, 403 manager, 200 admin", async ({ browser, baseURL }) => {
    for (const path of ["/api/admin/executive/dashboard", "/api/admin/executive/action-center"]) {
      const anonContext = await browser.newContext();
      const unauthResponse = await anonContext.request.get(path);
      expect(unauthResponse.status()).toBe(401);
      await anonContext.close();

      const managerContext = await browser.newContext();
      await addSessionCookie(managerContext, baseURL!, "manager");
      const managerResponse = await managerContext.request.get(path);
      expect(managerResponse.status()).toBe(403);
      await managerContext.close();

      const adminContext = await browser.newContext();
      await addSessionCookie(adminContext, baseURL!, "admin");
      const adminResponse = await adminContext.request.get(path);
      expect(adminResponse.ok()).toBeTruthy();
      const body = await adminResponse.json();
      expect(body.success).toBe(true);
      await adminContext.close();
    }
  });
});

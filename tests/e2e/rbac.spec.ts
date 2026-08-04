import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Enterprise CRM (Phase 1) — the 3-tier RBAC system re-audited during
 * the hardening pass (every protected route individually re-checked,
 * live, across all three roles) gets its first automated coverage
 * here: a counsellor is scoped to their own assigned leads (server-
 * enforced, not just hidden in the UI), and the one irreversible bulk
 * action (delete) stays admin-only even though bulk actions in general
 * are manager+.
 */
test.describe("RBAC — 3-tier permissions", () => {
  test("a counsellor gets 403 on a lead assigned to a different counsellor, but reaches their own", async ({
    browser,
    baseURL,
  }) => {
    const managerContext = await browser.newContext();
    await addSessionCookie(managerContext, baseURL!, "manager");

    const createResponse = await managerContext.request.post("/api/leads", {
      headers: { origin: baseURL! },
      data: {
        name: "RBAC Test Lead",
        email: `rbac-${Date.now()}@example.com`,
        phone: "+919876500001",
        source: "e2e-rbac",
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { lead } = await createResponse.json();

    const assignResponse = await managerContext.request.post(`/api/admin/leads/${lead.id}/assign`, {
      data: { counsellorId: "e2e-test-counsellor-owner-id" },
    });
    expect(assignResponse.ok()).toBeTruthy();
    await managerContext.close();

    // The owning counsellor reaches the lead's detail page.
    const ownerContext = await browser.newContext();
    await addSessionCookie(ownerContext, baseURL!, "counsellor", { id: "e2e-test-counsellor-owner-id" });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`/admin/leads/${lead.id}`);
    await expect(ownerPage.getByRole("heading", { name: "RBAC Test Lead" })).toBeVisible();
    await ownerContext.close();

    // A different counsellor is server-enforced out, not just hidden.
    const otherContext = await browser.newContext();
    await addSessionCookie(otherContext, baseURL!, "counsellor", { id: "e2e-test-counsellor-other-id" });
    const otherPage = await otherContext.newPage();
    await otherPage.goto(`/admin/leads/${lead.id}`);
    await expect(otherPage.getByText(/you don't have permission to view this/i)).toBeVisible();
    await otherContext.close();
  });

  test("bulk delete is admin-only even though a manager can reach other bulk actions", async ({
    browser,
    baseURL,
  }) => {
    const managerContext = await browser.newContext();
    await addSessionCookie(managerContext, baseURL!, "manager");

    const createResponse = await managerContext.request.post("/api/leads", {
      headers: { origin: baseURL! },
      data: {
        name: "Bulk Delete RBAC Lead",
        email: `rbac-bulk-${Date.now()}@example.com`,
        phone: "+919876500002",
        source: "e2e-rbac",
      },
    });
    const { lead } = await createResponse.json();

    // Manager: archive (a non-delete bulk action) succeeds.
    const archiveResponse = await managerContext.request.post("/api/admin/leads/bulk", {
      data: { action: "archive", ids: [lead.id] },
    });
    expect(archiveResponse.ok()).toBeTruthy();

    // Manager: delete is refused even though the route itself is manager+.
    const managerDeleteResponse = await managerContext.request.post("/api/admin/leads/bulk", {
      data: { action: "delete", ids: [lead.id] },
    });
    expect(managerDeleteResponse.status()).toBe(403);
    await managerContext.close();

    // Admin: the same delete succeeds.
    const adminContext = await browser.newContext();
    await addSessionCookie(adminContext, baseURL!, "admin");
    const adminDeleteResponse = await adminContext.request.post("/api/admin/leads/bulk", {
      data: { action: "delete", ids: [lead.id] },
    });
    expect(adminDeleteResponse.ok()).toBeTruthy();
    await adminContext.close();
  });

  test("Settings page: CRM Configuration is manager+, Environment Configuration is admin-only", async ({
    browser,
    baseURL,
  }) => {
    const counsellorContext = await browser.newContext();
    await addSessionCookie(counsellorContext, baseURL!, "counsellor");
    const counsellorPage = await counsellorContext.newPage();
    await counsellorPage.goto("/admin/settings");
    // Scoped to #main-content — the sticky header bar duplicates the
    // page title as its own <h1>.
    await expect(counsellorPage.locator("#main-content").getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(counsellorPage.getByRole("heading", { name: "CRM Configuration" })).toHaveCount(0);
    await counsellorContext.close();

    const managerContext = await browser.newContext();
    await addSessionCookie(managerContext, baseURL!, "manager");
    const managerPage = await managerContext.newPage();
    await managerPage.goto("/admin/settings");
    await expect(managerPage.getByRole("heading", { name: "CRM Configuration" })).toBeVisible();
    await expect(managerPage.getByText(/you don't have permission to view this/i)).toBeVisible();
    await managerContext.close();
  });

  test("Counsellor & Pipeline Analytics: the Leaderboard is manager-tier, distinct from the admin-only marketing sections", async ({
    browser,
    baseURL,
  }) => {
    const managerContext = await browser.newContext();
    await addSessionCookie(managerContext, baseURL!, "manager");
    const managerPage = await managerContext.newPage();
    await managerPage.goto("/admin/analytics");
    await expect(managerPage.getByRole("heading", { name: /counsellor leaderboard/i })).toBeVisible();
    await managerContext.close();
  });

  test("module 7.1 (Counsellor & Pipeline Analytics section) is manager-tier, no counsellor self-scoping", async ({
    browser,
    baseURL,
  }) => {
    const managerContext = await browser.newContext();
    await addSessionCookie(managerContext, baseURL!, "manager");
    const managerPage = await managerContext.newPage();
    await managerPage.goto("/admin/analytics");
    await expect(managerPage.getByRole("heading", { name: /counsellor & pipeline analytics/i })).toBeVisible();
    await managerContext.close();

    // No counsellor-tier self-scoping was built for this module (module
    // 1.6's own Leaderboard route has none either — see this module's
    // route doc comment) — a counsellor session should be forbidden,
    // the same as every other manager+ section on this page.
    const counsellorContext = await browser.newContext();
    await addSessionCookie(counsellorContext, baseURL!, "counsellor");
    const counsellorPage = await counsellorContext.newPage();
    await counsellorPage.goto("/admin/analytics");
    await expect(counsellorPage.getByRole("heading", { name: /counsellor & pipeline analytics/i })).toBeVisible();
    await expect(counsellorPage.getByText(/you don't have permission to view this/i).first()).toBeVisible();
    await counsellorContext.close();
  });
});

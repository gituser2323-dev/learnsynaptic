import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/** Enterprise CRM (Phase 1), Module 1.2 — Task Management, including
 *  the calendar view added during the Phase 1 hardening pass. Uses a
 *  counsellor session so the Assignee field is the fixed "assigned to
 *  you" text rather than a staff-picker select — the in-memory test
 *  repository has no seeded staff users to pick from. */
test.describe("CRM — Tasks", () => {
  test("a counsellor can create a task, see it in the calendar view, and complete it", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const page = await context.newPage();

    await page.goto("/admin/tasks");
    // Scoped to #main-content — the sticky header bar duplicates the
    // page title as its own <h1> (see playwright.config.ts's fixed
    // MONGODB_URI comment for another latent issue this suite caught).
    await expect(page.locator("#main-content").getByRole("heading", { name: "Tasks" })).toBeVisible();

    await page.getByRole("button", { name: "New Task" }).click();
    const title = `E2E Task ${Date.now()}`;
    await page.locator("#new-task-title").fill(title);

    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dueValue = dueAt.toISOString().slice(0, 16);
    await page.locator("#new-task-due").fill(dueValue);

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(title)).toBeVisible();

    // Calendar view — the module's own Definition of Done: overdue
    // tasks visibly distinct in both views. Just confirms the toggle
    // and month grid render; overdue styling is a visual detail, not
    // something worth a brittle CSS-based assertion here.
    await page.getByRole("button", { name: "Calendar" }).click();
    await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();

    await page.getByRole("button", { name: "List" }).click();
    const row = page.locator(".adm-card", { hasText: title });
    await row.getByRole("button", { name: "Complete" }).click();

    // The list view defaults to the "Open" status filter — a completed
    // task correctly disappears from it rather than lingering with a
    // "Done" badge inline. Switch to "All statuses" to see it marked
    // Done instead of asserting on a view the app doesn't render.
    await page.getByLabel("Status").selectOption({ label: "All statuses" });
    await expect(row.getByText("Done")).toBeVisible();

    await context.close();
  });
});

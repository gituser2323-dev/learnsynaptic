import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * WhatsApp Platform (Phase 2), Module 2.1/2.2 — Conversations.
 *
 * Scoped deliberately narrower than the other new specs in this pass:
 * a Conversation only comes into existence through the inbound webhook
 * path (app/api/webhooks/whatsapp), which requires the `meta-cloud-api`
 * provider active and a matching HMAC app secret to pass signature
 * verification. Flipping WHATSAPP_PROVIDER globally for this shared
 * webServer would change every other spec's WhatsApp send behavior too
 * (e.g. automation.spec.ts's auto-reply happy path, which relies on the
 * `console` provider's synthetic success) — not a safe trade for one
 * spec file. So this covers what's reachable without a seeded
 * Conversation (empty state, RBAC) rather than the full thread/reply
 * flow; that gap is disclosed in CHANGELOG.md, not hidden.
 *
 * Phase 2A — Conversations are counsellor+ (manager/admin org-wide;
 * counsellor self-scoped). Manager must no longer see ForbiddenState.
 */
test.describe("Conversations — page shell and RBAC", () => {
  test("admin reaches the Conversations page and sees the empty state with zero conversations", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const page = await context.newPage();
    await page.goto("/admin/conversations");
    // Scoped to #main-content — the sticky header bar duplicates the
    // page title as its own <h1>.
    await expect(page.locator("#main-content").getByRole("heading", { name: "Conversations" })).toBeVisible();
    await expect(page.getByText(/no conversations/i)).toBeVisible();
    await context.close();
  });

  test("a manager session can open Conversations (org-wide inbox)", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const page = await context.newPage();
    await page.goto("/admin/conversations");
    await expect(page.locator("#main-content").getByRole("heading", { name: "Conversations" })).toBeVisible();
    await expect(page.getByText(/you don't have permission to view this/i)).toHaveCount(0);
    await expect(page.getByText(/no conversations/i)).toBeVisible();
    await context.close();
  });

  test("a counsellor session can open Conversations (assigned-lead scope)", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const page = await context.newPage();
    await page.goto("/admin/conversations");
    await expect(page.locator("#main-content").getByRole("heading", { name: "Conversations" })).toBeVisible();
    await expect(page.getByText(/you don't have permission to view this/i)).toHaveCount(0);
    await expect(page.getByText(/no conversations for your assigned leads|no conversations match/i)).toBeVisible();
    await context.close();
  });

  test("counsellor cannot assign (manager+ only)", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const response = await context.request.post(`${baseURL}/api/admin/conversations/no-such-id/assign`, {
      data: { userId: "someone" },
    });
    expect(response.status()).toBe(403);
    await context.close();
  });
});

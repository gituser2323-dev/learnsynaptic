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

  test("a manager session is forbidden — Conversations is admin-tier per the Blueprint", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const page = await context.newPage();
    await page.goto("/admin/conversations");
    await expect(page.getByText(/you don't have permission to view this/i)).toBeVisible();
    await context.close();
  });
});

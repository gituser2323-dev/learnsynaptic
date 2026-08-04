import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * AI CRM (Phase 5), Module 5.2 — AI-Assisted Replies.
 *
 * Same disclosed constraint conversations.spec.ts's own top comment
 * already states: a real Conversation only comes into existence
 * through the inbound webhook path, which needs a real vendor active —
 * not a safe global flip for this shared webServer. So this covers
 * what's reachable without a seeded Conversation (RBAC, 404 for a
 * nonexistent id) via direct API requests; the full "generate a
 * suggestion, insert into composer" UI flow against a real seeded
 * conversation is live-verified separately (see the module's own
 * CHANGELOG entry), the same split 2.1/2.2 already took.
 */
test.describe("AI-Assisted Replies (5.2) — RBAC and error shape", () => {
  test("a manager session is forbidden — same admin tier as every other Conversations route", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const response = await context.request.post(`${baseURL}/api/admin/conversations/no-such-id/ai-reply`, {
      data: { tone: "professional" },
    });
    expect(response.status()).toBe(403);
    await context.close();
  });

  test("an admin gets a 404 for a conversation id that doesn't exist", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.post(`${baseURL}/api/admin/conversations/no-such-id/ai-reply`, {
      data: { tone: "professional" },
    });
    expect(response.status()).toBe(404);
    await context.close();
  });

  test("an admin gets a 400 for an unrecognized tone", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.post(`${baseURL}/api/admin/conversations/no-such-id/ai-reply`, {
      data: { tone: "sarcastic" },
    });
    expect(response.status()).toBe(400);
    await context.close();
  });
});

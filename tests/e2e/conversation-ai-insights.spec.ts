import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * AI CRM (Phase 5), Module 5.3 — Conversational Analytics.
 *
 * Same disclosed constraint conversations.spec.ts's own top comment
 * and 5.2's own AI-reply spec already state: a real Conversation only
 * comes into existence through the inbound webhook path, which needs a
 * real vendor active — not a safe global flip for this shared
 * webServer. So this covers what's reachable without a seeded
 * Conversation via direct API requests; the full "generate an
 * analysis, view badges/history" UI flow against a real seeded
 * conversation is live-verified separately (see the module's own
 * CHANGELOG entry).
 */
test.describe("Conversational Analytics (5.3) — RBAC and error shape", () => {
  test("a manager session is forbidden — same admin tier as every other Conversations route", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const getResponse = await context.request.get(`${baseURL}/api/admin/conversations/no-such-id/insights`);
    expect(getResponse.status()).toBe(403);
    const postResponse = await context.request.post(`${baseURL}/api/admin/conversations/no-such-id/insights`);
    expect(postResponse.status()).toBe(403);
    await context.close();
  });

  test("an admin gets a 404 analyzing a conversation id that doesn't exist", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.post(`${baseURL}/api/admin/conversations/no-such-id/insights`);
    expect(response.status()).toBe(404);
    await context.close();
  });

  test("an admin gets an empty history list for a conversation id that doesn't exist (list doesn't 404)", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "admin");
    const response = await context.request.get(`${baseURL}/api/admin/conversations/no-such-id/insights`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.total).toBe(0);
    await context.close();
  });
});

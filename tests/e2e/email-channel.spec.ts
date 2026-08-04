import { test, expect } from "@playwright/test";

/**
 * Communication Center (Phase 4), Module 4.2 — Email Channel Integration.
 *
 * Scoped the same deliberate way conversations.spec.ts already is for
 * WhatsApp's own inbound path, and for the identical reason: an email
 * Conversation only comes into existence through the inbound webhook
 * (app/api/webhooks/email), which requires the `postmark` provider
 * active to actually parse a payload — the shared webServer runs with
 * EMAIL_PROVIDER unset (defaults to `console`, same as WHATSAPP_PROVIDER
 * defaults to `console` for every other spec), so flipping it globally
 * would risk a real outbound network call to Postmark's live API from
 * any test that exercises an email conversation's reply path (unlike
 * WhatsApp, an email send has no dev-safe "queue of one" indirection to
 * intercept). This spec covers what's reachable without a real vendor
 * configured — the auth gate and response contract — not the full
 * inbound-to-thread-view flow. That gap is disclosed in CHANGELOG.md
 * and verified instead via a live regression script against the real
 * MongoDB replica set and the real Postmark JSON shape, not skipped.
 */
test.describe("Email Channel — inbound webhook auth gate", () => {
  test("rejects a request with no token", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/webhooks/email`, {
      data: { FromFull: { Email: "someone@example.com" }, Subject: "Hi", TextBody: "Hello" },
    });
    expect(response.status()).toBe(401);
  });

  test("rejects a request with the wrong token", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/webhooks/email?token=wrong-token`, {
      data: { FromFull: { Email: "someone@example.com" }, Subject: "Hi", TextBody: "Hello" },
    });
    expect(response.status()).toBe(401);
  });

  // No token is configured for this shared webServer (EMAIL_POSTMARK_INBOUND_TOKEN
  // is unset, same as every other vendor credential across this suite) —
  // isAuthorized() fails closed regardless of what token a caller supplies,
  // the same "no secret configured means reject everything" posture
  // metaCloudApi.provider.ts's own isValidSignature already takes. This
  // confirms the fail-closed behavior itself, not a successful auth.
  test("fails closed even with a well-formed-looking token when no secret is configured", async ({
    request,
    baseURL,
  }) => {
    const response = await request.post(`${baseURL}/api/webhooks/email?token=anything-at-all`, {
      data: { FromFull: { Email: "someone@example.com" }, Subject: "Hi", TextBody: "Hello" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.received).toBe(false);
  });
});

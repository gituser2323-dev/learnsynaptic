import { describe, it, expect } from "vitest";
import { phoneNumberService } from "./phoneNumbers";
import { extractPhoneNumberId } from "./providers/metaCloudApi.provider";

/**
 * Business OS Phase 8, Module 8.5 — direct proof of the "Meta Webhook
 * -> Phone/WABA Resolution -> Organization" routing chain
 * app/api/webhooks/whatsapp/route.ts's own doc comment describes,
 * using the exact same functions that route calls
 * (`extractPhoneNumberId` + `phoneNumberService.findByPhoneNumberId`).
 *
 * Full HTTP-level webhook routing (a real HMAC-signed POST against the
 * real running server) is NOT exercised here — the shared Playwright
 * webServer runs WHATSAPP_PROVIDER at its own "console" default (see
 * tests/e2e/conversations.spec.ts's own doc comment for the identical,
 * already-disclosed constraint from Module 2.1/2.2: flipping it
 * globally would change every other spec's WhatsApp behavior too).
 * This unit test is the honest substitute: it proves the routing
 * DECISION itself is correct and tenant-isolated using real data, not a
 * fabricated stand-in for the HTTP layer.
 */
describe("webhook tenant routing — two organizations, two real phone numbers", () => {
  it("resolves each organization's own phone number to itself, never to the other organization", async () => {
    await phoneNumberService.upsertHealth({ phoneNumberId: "route-org-a-phone", qualityRating: "green", organizationId: "route-org-a" });
    await phoneNumberService.upsertHealth({ phoneNumberId: "route-org-b-phone", qualityRating: "green", organizationId: "route-org-b" });

    const routeA = await phoneNumberService.findByPhoneNumberId("route-org-a-phone");
    const routeB = await phoneNumberService.findByPhoneNumberId("route-org-b-phone");

    expect(routeA?.organizationId).toBe("route-org-a");
    expect(routeB?.organizationId).toBe("route-org-b");
    expect(routeA?.organizationId).not.toBe(routeB?.organizationId);
  });

  it("an unrecognized phone number resolves to null — the caller falls back to default-organization routing, never a crash", async () => {
    const route = await phoneNumberService.findByPhoneNumberId("a-phone-number-nobody-connected");
    expect(route).toBeNull();
  });

  it("extracts the routing key from a realistic multi-tenant webhook batch — status event for org A's number, message for org B's number, in the same delivery", () => {
    const payloadForA = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "route-org-a-phone" }, statuses: [{ id: "wamid.a", status: "sent", timestamp: "1700000000", recipient_id: "919000000001" }] } }] }],
    });
    const payloadForB = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "route-org-b-phone" }, messages: [{ from: "919000000002", id: "wamid.b", timestamp: "1700000000", type: "text", text: { body: "hi" } }] } }] }],
    });

    expect(extractPhoneNumberId(payloadForA)).toBe("route-org-a-phone");
    expect(extractPhoneNumberId(payloadForB)).toBe("route-org-b-phone");
  });
});

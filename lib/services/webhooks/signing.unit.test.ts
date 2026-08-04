import { describe, it, expect } from "vitest";
import { signWebhookPayload, verifySignature } from "./signing";

describe("signing — HMAC-SHA256 outbound webhook signatures (GitHub/Stripe-shaped)", () => {
  it("signs a payload and the signature verifies against the same secret/timestamp/body", () => {
    const secret = "a-real-endpoint-secret";
    const rawBody = JSON.stringify({ id: "evt_1", type: "lead.created", payload: { leadId: "lead_1" } });
    const headers = signWebhookPayload(secret, "lead.created", rawBody);

    expect(headers["X-LearnSynaptic-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(headers["X-LearnSynaptic-Event"]).toBe("lead.created");
    expect(
      verifySignature(secret, headers["X-LearnSynaptic-Timestamp"], rawBody, headers["X-LearnSynaptic-Signature"]),
    ).toBe(true);
  });

  it("rejects verification against the wrong secret", () => {
    const rawBody = JSON.stringify({ id: "evt_1", type: "lead.created", payload: {} });
    const headers = signWebhookPayload("secret-a", "lead.created", rawBody);
    expect(verifySignature("secret-b", headers["X-LearnSynaptic-Timestamp"], rawBody, headers["X-LearnSynaptic-Signature"])).toBe(false);
  });

  it("rejects verification when the body has been tampered with after signing", () => {
    const secret = "a-real-endpoint-secret";
    const headers = signWebhookPayload(secret, "lead.created", JSON.stringify({ leadId: "lead_1" }));
    const tamperedBody = JSON.stringify({ leadId: "lead_2" });
    expect(verifySignature(secret, headers["X-LearnSynaptic-Timestamp"], tamperedBody, headers["X-LearnSynaptic-Signature"])).toBe(false);
  });

  it("rejects verification when the timestamp has been tampered with after signing", () => {
    const secret = "a-real-endpoint-secret";
    const rawBody = JSON.stringify({ leadId: "lead_1" });
    const headers = signWebhookPayload(secret, "lead.created", rawBody);
    const tamperedTimestamp = (Number(headers["X-LearnSynaptic-Timestamp"]) + 1).toString();
    expect(verifySignature(secret, tamperedTimestamp, rawBody, headers["X-LearnSynaptic-Signature"])).toBe(false);
  });

  it("accepts a signature header without the 'sha256=' prefix too (verifySignature strips it either way)", () => {
    const secret = "a-real-endpoint-secret";
    const rawBody = JSON.stringify({ leadId: "lead_1" });
    const headers = signWebhookPayload(secret, "lead.created", rawBody);
    const bareSignature = headers["X-LearnSynaptic-Signature"].replace(/^sha256=/, "");
    expect(verifySignature(secret, headers["X-LearnSynaptic-Timestamp"], rawBody, bareSignature)).toBe(true);
  });
});

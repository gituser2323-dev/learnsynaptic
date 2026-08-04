import { describe, it, expect } from "vitest";
import { normalizeTemplateStatus, normalizeQualityRating, extractPhoneNumberId } from "./metaCloudApi.provider";

/**
 * Module 2.3 — Template Sync & Business Account Health. These two
 * mapping functions are the only real branching logic in the module
 * that doesn't require a live Graph API call to exercise — worth
 * locking in directly rather than only ever seeing them run against a
 * real (or rejected) HTTP response.
 */
describe("normalizeTemplateStatus", () => {
  it("maps APPROVED (any case) to approved", () => {
    expect(normalizeTemplateStatus("APPROVED")).toBe("approved");
    expect(normalizeTemplateStatus("approved")).toBe("approved");
  });

  it("maps REJECTED (any case) to rejected", () => {
    expect(normalizeTemplateStatus("REJECTED")).toBe("rejected");
    expect(normalizeTemplateStatus("rejected")).toBe("rejected");
  });

  it.each(["PENDING", "IN_APPEAL", "PAUSED", "SOMETHING_UNKNOWN_META_ADDS_LATER"])(
    "maps every non-terminal status (%s) to pending, not a crash or a silent approve",
    (raw) => {
      expect(normalizeTemplateStatus(raw)).toBe("pending");
    },
  );
});

describe("normalizeQualityRating", () => {
  it.each([
    ["GREEN", "green"],
    ["YELLOW", "yellow"],
    ["RED", "red"],
    ["green", "green"],
  ])("maps %s to %s", (raw, expected) => {
    expect(normalizeQualityRating(raw)).toBe(expected);
  });

  it("maps an unrecognized or missing rating to unknown, never a wrong color", () => {
    expect(normalizeQualityRating("SOMETHING_NEW")).toBe("unknown");
    expect(normalizeQualityRating(undefined)).toBe("unknown");
    expect(normalizeQualityRating("")).toBe("unknown");
  });
});

/**
 * Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup's own
 * webhook-routing requirement: extracting `phone_number_id` from a real
 * Meta webhook payload shape, before any signature verification or
 * tenant-context resolution happens (both are the caller's own job —
 * see app/api/webhooks/whatsapp/route.ts's own doc comment).
 */
describe("extractPhoneNumberId", () => {
  it("extracts the phone number id from a real status-event payload", () => {
    const payload = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "111222333" }, statuses: [{ id: "wamid.1", status: "delivered", timestamp: "1700000000", recipient_id: "919876543210" }] } }] }],
    });
    expect(extractPhoneNumberId(payload)).toBe("111222333");
  });

  it("extracts the phone number id from a real inbound-message payload", () => {
    const payload = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "444555666" }, messages: [{ from: "919876543210", id: "wamid.2", timestamp: "1700000000", type: "text", text: { body: "hi" } }] } }] }],
    });
    expect(extractPhoneNumberId(payload)).toBe("444555666");
  });

  it("returns null for malformed JSON, never throws", () => {
    expect(extractPhoneNumberId("{not json")).toBeNull();
  });

  it("returns null when no phone_number_id is present anywhere in the payload", () => {
    expect(extractPhoneNumberId(JSON.stringify({ entry: [{ changes: [{ value: {} }] }] }))).toBeNull();
    expect(extractPhoneNumberId(JSON.stringify({}))).toBeNull();
  });
});

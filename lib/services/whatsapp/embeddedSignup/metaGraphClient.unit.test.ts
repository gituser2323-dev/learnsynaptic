import { describe, it, expect, vi, afterEach } from "vitest";
import { exchangeCodeForToken, listWabaPhoneNumbers, subscribeAppToWaba, unsubscribeAppFromWaba, normalizeVerificationStatus, normalizeQualityRating } from "./metaGraphClient";
import { EmbeddedSignupError } from "./types";

/**
 * Business OS Phase 8, Module 8.5 — the server-side Meta Graph API
 * calls Embedded Signup needs beyond messaging. These don't depend on
 * `config/whatsapp.ts`'s own env-derived "is embedded signup
 * configured" gate (that check lives one layer up, in
 * embeddedSignupService) — they simply build a request against
 * whatever `META_EMBEDDED_SIGNUP_CONFIG`/`META_CLOUD_API_CONFIG` values
 * are currently set (empty strings in this test environment) and
 * interpret the mocked response, exactly the same "real request shape,
 * mocked network boundary" discipline metaCloudApi.provider.ts's own
 * unit tests already established for messaging.
 */
describe("exchangeCodeForToken", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns the access token on a real successful Meta response", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: "EAABtoken123", token_type: "bearer" }), { status: 200 })) as unknown as typeof fetch;
    const token = await exchangeCodeForToken("a-real-code");
    expect(token).toBe("EAABtoken123");
  });

  it("throws EmbeddedSignupError('exchange_failed') on a real Meta rejection", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid authorization code" } }), { status: 400 })) as unknown as typeof fetch;
    await expect(exchangeCodeForToken("bad-code")).rejects.toMatchObject({ code: "exchange_failed" });
  });

  it("throws EmbeddedSignupError('meta_unavailable') on a real network failure", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await expect(exchangeCodeForToken("any-code")).rejects.toBeInstanceOf(EmbeddedSignupError);
    await expect(exchangeCodeForToken("any-code")).rejects.toMatchObject({ code: "meta_unavailable" });
  });
});

describe("listWabaPhoneNumbers", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("normalizes every real phone number Meta returns", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              { id: "1234567890", display_phone_number: "+1 555-0100", verified_name: "Acme Corp", code_verification_status: "VERIFIED", quality_rating: "GREEN" },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const numbers = await listWabaPhoneNumbers("waba-1", "token");
    expect(numbers).toEqual([
      { phoneNumberId: "1234567890", displayPhoneNumber: "+1 555-0100", verifiedName: "Acme Corp", verificationStatus: "verified", qualityRating: "green" },
    ]);
  });

  it("throws EmbeddedSignupError('discovery_failed') when Meta rejects the WABA lookup", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Unsupported request" } }), { status: 400 })) as unknown as typeof fetch;
    await expect(listWabaPhoneNumbers("waba-1", "token")).rejects.toMatchObject({ code: "discovery_failed" });
  });

  it("returns an empty array for a WABA with genuinely no phone numbers yet", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as unknown as typeof fetch;
    expect(await listWabaPhoneNumbers("waba-1", "token")).toEqual([]);
  });
});

describe("subscribeAppToWaba / unsubscribeAppFromWaba", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("resolves silently on a real successful subscribe", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })) as unknown as typeof fetch;
    await expect(subscribeAppToWaba("waba-1", "token")).resolves.toBeUndefined();
  });

  it("throws when Meta rejects the subscribe call", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Permission denied" } }), { status: 403 })) as unknown as typeof fetch;
    await expect(subscribeAppToWaba("waba-1", "token")).rejects.toMatchObject({ code: "discovery_failed" });
  });

  it("unsubscribe never throws even when the underlying call fails — a best-effort call on the disconnect path", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("token already revoked");
    }) as unknown as typeof fetch;
    await expect(unsubscribeAppFromWaba("waba-1", "expired-token")).resolves.toBeUndefined();
  });
});

describe("normalizeVerificationStatus / normalizeQualityRating", () => {
  it.each([
    ["VERIFIED", "verified"],
    ["NOT_VERIFIED", "not_verified"],
    ["EXPIRED", "not_verified"],
    ["PENDING", "not_verified"],
    ["SOMETHING_NEW", "unknown"],
    [undefined, "unknown"],
  ])("normalizes %s to %s", (raw, expected) => {
    expect(normalizeVerificationStatus(raw as string | undefined)).toBe(expected);
  });

  it.each([
    ["GREEN", "green"],
    ["YELLOW", "yellow"],
    ["RED", "red"],
    ["UNKNOWN_FUTURE_VALUE", "unknown"],
  ])("normalizes %s to %s", (raw, expected) => {
    expect(normalizeQualityRating(raw)).toBe(expected);
  });
});

import { describe, it, expect, vi } from "vitest";
import { createOAuthState, verifyOAuthState } from "./oauthState";

describe("oauthState — CSRF protection for the OAuth authorize→callback round trip", () => {
  it("round-trips: a freshly created state verifies and returns the same providerId", () => {
    const state = createOAuthState("google_calendar");
    expect(verifyOAuthState(state)).toBe("google_calendar");
  });

  it("returns null for a completely malformed state string", () => {
    expect(verifyOAuthState("not-a-real-state-token")).toBeNull();
  });

  it("returns null for a tampered payload (signature no longer matches)", () => {
    const state = createOAuthState("zoom");
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    const tampered = { ...decoded, providerId: "microsoft_outlook_calendar" };
    const tamperedState = Buffer.from(JSON.stringify(tampered)).toString("base64url");
    expect(verifyOAuthState(tamperedState)).toBeNull();
  });

  it("returns null for an expired state", () => {
    vi.useFakeTimers();
    try {
      const state = createOAuthState("google_meet");
      vi.advanceTimersByTime(11 * 60_000); // Past the 10-minute TTL.
      expect(verifyOAuthState(state)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("generates a different state (different nonce) on every call for the same provider", () => {
    const a = createOAuthState("zoom");
    const b = createOAuthState("zoom");
    expect(a).not.toBe(b);
  });
});

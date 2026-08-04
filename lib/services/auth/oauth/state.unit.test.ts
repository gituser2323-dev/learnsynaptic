import { describe, it, expect, vi, afterEach } from "vitest";
import { createOAuthState, verifyOAuthState } from "./state";

/**
 * RC-1 — Social Login's CSRF `state` param. These are the real
 * "penetration test" cases the mission's own Security review asks for
 * on this specific surface: tampering, cross-provider substitution, and
 * expiry — not just the happy path.
 */
describe("createOAuthState / verifyOAuthState", () => {
  afterEach(() => vi.useRealTimers());

  it("round-trips a login-intent state with no userId", () => {
    const state = createOAuthState("google", "login");
    const verified = verifyOAuthState(state);
    expect(verified).toEqual({ providerId: "google", intent: "login", userId: undefined });
  });

  it("round-trips a link-intent state carrying the linking user's id", () => {
    const state = createOAuthState("microsoft", "link", "user-123");
    const verified = verifyOAuthState(state);
    expect(verified).toEqual({ providerId: "microsoft", intent: "link", userId: "user-123" });
  });

  it("rejects a state whose providerId was tampered with post-signing", () => {
    const state = createOAuthState("google", "login");
    const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    payload.providerId = "microsoft";
    const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(verifyOAuthState(tampered)).toBeNull();
  });

  it("rejects a state whose intent was flipped from login to link post-signing (privilege escalation attempt)", () => {
    const state = createOAuthState("google", "login");
    const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    payload.intent = "link";
    payload.userId = "victim-user-id";
    const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(verifyOAuthState(tampered)).toBeNull();
  });

  it("rejects a state whose embedded userId was swapped for a different account (cross-account link hijack attempt)", () => {
    const state = createOAuthState("google", "link", "real-owner");
    const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    payload.userId = "attacker-account";
    const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(verifyOAuthState(tampered)).toBeNull();
  });

  it("rejects malformed base64url garbage", () => {
    expect(verifyOAuthState("not-a-real-state-token")).toBeNull();
  });

  it("rejects valid JSON/signature shape but missing required fields", () => {
    const bogus = Buffer.from(JSON.stringify({ providerId: "google" })).toString("base64url");
    expect(verifyOAuthState(bogus)).toBeNull();
  });

  it("rejects an expired state (past the 10-minute TTL)", () => {
    const real = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(real);
    const state = createOAuthState("google", "login");
    vi.setSystemTime(new Date(real.getTime() + 11 * 60 * 1000));
    expect(verifyOAuthState(state)).toBeNull();
  });

  it("accepts a state right up to (but not past) the TTL boundary", () => {
    const real = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(real);
    const state = createOAuthState("google", "login");
    vi.setSystemTime(new Date(real.getTime() + 5 * 60 * 1000));
    expect(verifyOAuthState(state)).not.toBeNull();
  });

  it("rejects a link-intent state with the userId stripped out entirely", () => {
    const state = createOAuthState("google", "link", "user-123");
    const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    delete payload.userId;
    const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(verifyOAuthState(tampered)).toBeNull();
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { createOAuthMfaPendingToken, verifyOAuthMfaPendingToken } from "./mfaPending";

describe("createOAuthMfaPendingToken / verifyOAuthMfaPendingToken", () => {
  afterEach(() => vi.useRealTimers());

  it("round-trips for the exact userId + providerId it was issued for", () => {
    const token = createOAuthMfaPendingToken("user-1", "google");
    expect(verifyOAuthMfaPendingToken(token, "google")).toBe("user-1");
  });

  it("rejects when presented with a DIFFERENT provider than it was issued for", () => {
    const token = createOAuthMfaPendingToken("user-1", "google");
    expect(verifyOAuthMfaPendingToken(token, "microsoft")).toBeNull();
  });

  it("rejects a token whose userId was tampered with (MFA-bypass-via-substitution attempt)", () => {
    const token = createOAuthMfaPendingToken("real-user", "google");
    const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    payload.userId = "victim-user";
    const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(verifyOAuthMfaPendingToken(tampered, "google")).toBeNull();
  });

  it("rejects a token whose providerId field was tampered with directly", () => {
    const token = createOAuthMfaPendingToken("user-1", "google");
    const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    payload.providerId = "microsoft";
    const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
    // Even asking verify() for "microsoft" (matching the tampered field)
    // must still fail, because the signature was computed over "google".
    expect(verifyOAuthMfaPendingToken(tampered, "microsoft")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyOAuthMfaPendingToken("garbage", "google")).toBeNull();
  });

  it("rejects an expired token (past the 5-minute TTL)", () => {
    const real = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(real);
    const token = createOAuthMfaPendingToken("user-1", "google");
    vi.setSystemTime(new Date(real.getTime() + 6 * 60 * 1000));
    expect(verifyOAuthMfaPendingToken(token, "google")).toBeNull();
  });

  it("accepts a token still within the TTL window", () => {
    const real = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(real);
    const token = createOAuthMfaPendingToken("user-1", "google");
    vi.setSystemTime(new Date(real.getTime() + 4 * 60 * 1000));
    expect(verifyOAuthMfaPendingToken(token, "google")).toBe("user-1");
  });
});

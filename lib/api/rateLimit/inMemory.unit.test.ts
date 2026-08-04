import { describe, it, expect, vi, afterEach } from "vitest";
import { inMemoryRateLimiter } from "./inMemory";

/**
 * RC-2 Enterprise Security Hardening — `inMemoryRateLimiter` backs
 * every one of this app's ~150 API routes' own `rateLimit` option
 * (withApiRoute.ts) yet had zero dedicated test coverage before this
 * pass. Real fixed-window behavior, exercised directly — not mocked.
 */

let counter = 0;
function uniqueKey(): string {
  counter += 1;
  return `test-key-${counter}-${Math.random()}`;
}

describe("inMemoryRateLimiter.check", () => {
  afterEach(() => vi.useRealTimers());

  it("allows requests up to the limit, then rejects the next one within the same window", async () => {
    const key = uniqueKey();
    const limit = 3;
    for (let i = 0; i < limit; i++) {
      const result = await inMemoryRateLimiter.check(key, limit, 60_000);
      expect(result.allowed).toBe(true);
    }
    const overLimit = await inMemoryRateLimiter.check(key, limit, 60_000);
    expect(overLimit.allowed).toBe(false);
    expect(overLimit.remaining).toBe(0);
  });

  it("reports decreasing `remaining` as the window fills up", async () => {
    const key = uniqueKey();
    const first = await inMemoryRateLimiter.check(key, 5, 60_000);
    const second = await inMemoryRateLimiter.check(key, 5, 60_000);
    expect(first.remaining).toBe(4);
    expect(second.remaining).toBe(3);
  });

  it("pentest — Rate-Limit Bypass: two DIFFERENT keys (e.g. two different client IPs) never share one bucket", async () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    const limit = 2;
    await inMemoryRateLimiter.check(keyA, limit, 60_000);
    await inMemoryRateLimiter.check(keyA, limit, 60_000);
    const keyAOverLimit = await inMemoryRateLimiter.check(keyA, limit, 60_000);
    expect(keyAOverLimit.allowed).toBe(false);

    // keyB's own budget is completely untouched by keyA's usage.
    const keyBFirst = await inMemoryRateLimiter.check(keyB, limit, 60_000);
    expect(keyBFirst.allowed).toBe(true);
  });

  it("resets the window after it elapses — a legitimate client isn't permanently blocked", async () => {
    const key = uniqueKey();
    const real = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(real);

    await inMemoryRateLimiter.check(key, 1, 60_000);
    const withinWindow = await inMemoryRateLimiter.check(key, 1, 60_000);
    expect(withinWindow.allowed).toBe(false);

    vi.setSystemTime(new Date(real.getTime() + 61_000));
    const afterWindow = await inMemoryRateLimiter.check(key, 1, 60_000);
    expect(afterWindow.allowed).toBe(true);
  });

  it("a request exactly at the window boundary is treated as a fresh window (>=, not >)", async () => {
    const key = uniqueKey();
    const real = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(real);

    await inMemoryRateLimiter.check(key, 1, 60_000);
    vi.setSystemTime(new Date(real.getTime() + 60_000)); // exactly the window length
    const result = await inMemoryRateLimiter.check(key, 1, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("reports a resetAt timestamp in the future for a rejected request", async () => {
    const key = uniqueKey();
    await inMemoryRateLimiter.check(key, 1, 60_000);
    const rejected = await inMemoryRateLimiter.check(key, 1, 60_000);
    expect(rejected.allowed).toBe(false);
    expect(rejected.resetAt).toBeGreaterThan(Date.now());
  });
});

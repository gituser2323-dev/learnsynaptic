import { describe, it, expect, vi, afterEach } from "vitest";
import { createUpstashRateLimiter } from "./upstash";
import type { Redis } from "@upstash/redis";

function mockRedis(overrides: Partial<Redis> = {}): Redis {
  return {
    incr: vi.fn(),
    pexpire: vi.fn(),
    ...overrides,
  } as unknown as Redis;
}

describe("createUpstashRateLimiter", () => {
  afterEach(() => vi.useRealTimers());

  it("allows requests up to the limit within a fixed window, then rejects", async () => {
    let count = 0;
    const redis = mockRedis({
      incr: vi.fn(async () => {
        count += 1;
        return count;
      }),
      pexpire: vi.fn(async () => 1 as const),
    });
    const limiter = createUpstashRateLimiter(redis);
    const key = "ip:1.2.3.4";
    expect((await limiter.check(key, 2, 60_000)).allowed).toBe(true);
    expect((await limiter.check(key, 2, 60_000)).allowed).toBe(true);
    const over = await limiter.check(key, 2, 60_000);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
    expect(redis.pexpire).toHaveBeenCalledTimes(1);
  });

  it("fails open (allows) when Redis throws", async () => {
    const onError = vi.fn();
    const redis = mockRedis({
      incr: vi.fn(async () => {
        throw new Error("upstash down");
      }),
    });
    const limiter = createUpstashRateLimiter(redis, onError);
    const result = await limiter.check("k", 1, 60_000);
    expect(result.allowed).toBe(true);
    expect(onError).toHaveBeenCalled();
  });

  it("reports decreasing remaining", async () => {
    let count = 0;
    const redis = mockRedis({
      incr: vi.fn(async () => ++count),
      pexpire: vi.fn(async () => 1 as const),
    });
    const limiter = createUpstashRateLimiter(redis);
    const first = await limiter.check("k", 5, 60_000);
    const second = await limiter.check("k", 5, 60_000);
    expect(first.remaining).toBe(4);
    expect(second.remaining).toBe(3);
  });
});

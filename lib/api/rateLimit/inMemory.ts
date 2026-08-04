import type { RateLimitResult, RateLimiter } from "./types";

/**
 * Fixed-window, in-memory rate limiter — the default until a distributed
 * store is configured. Correct for a single running instance; KNOWN
 * LIMITATION: state is per-process, so in a multi-instance serverless
 * deployment each instance enforces the limit independently, meaning the
 * effective global limit is roughly (configured limit × instance count),
 * not the configured limit exactly. This is an honest trade-off, not a
 * bug — swapping in a Redis-backed RateLimiter (e.g. Upstash) later is a
 * one-file change because callers depend only on the RateLimiter
 * interface (types.ts), never on this implementation.
 *
 * Bucket count is capped: once the map exceeds MAX_BUCKETS, expired
 * entries are swept before adding a new one, so long-running processes
 * with many distinct keys (e.g. many client IPs) don't grow unbounded.
 */
const MAX_BUCKETS = 10_000;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

function sweepExpired(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= windowMs) {
      buckets.delete(key);
    }
  }
}

export const inMemoryRateLimiter: RateLimiter = {
  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      if (buckets.size >= MAX_BUCKETS) sweepExpired(now, windowMs);
      buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (bucket.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: bucket.windowStart + windowMs };
    }

    bucket.count += 1;
    return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.windowStart + windowMs };
  },
};

import { Redis } from "@upstash/redis";
import type { RateLimitResult, RateLimiter } from "./types";

/**
 * Fixed-window RateLimiter backed by Upstash Redis (REST).
 * Same public contract as inMemoryRateLimiter — used only for distributed
 * per-IP API rate limits across serverless isolates. Not a job queue.
 *
 * Window alignment uses wall-clock buckets (`floor(now / windowMs)`), which
 * is slightly different from the in-memory "window starts on first hit"
 * semantics but is the standard Redis fixed-window pattern and is correct
 * for abuse bounding.
 *
 * On Redis errors: fail OPEN (allow the request) and log — availability
 * over a hard lockout if Upstash is unreachable. In-memory remains the
 * fallback when Upstash env vars are unset.
 */
export function createUpstashRateLimiter(
  redis: Redis,
  onError?: (err: unknown) => void,
): RateLimiter {
  return {
    async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
      try {
        const now = Date.now();
        const bucket = Math.floor(now / windowMs);
        const redisKey = `rl:fw:${windowMs}:${key}:${bucket}`;
        const count = await redis.incr(redisKey);
        if (count === 1) {
          await redis.pexpire(redisKey, windowMs);
        }
        const resetAt = (bucket + 1) * windowMs;
        if (count > limit) {
          return { allowed: false, remaining: 0, resetAt };
        }
        return { allowed: true, remaining: Math.max(0, limit - count), resetAt };
      } catch (err) {
        onError?.(err);
        const now = Date.now();
        return { allowed: true, remaining: limit, resetAt: now + windowMs };
      }
    },
  };
}

export function createUpstashRateLimiterFromEnv(
  onError?: (err: unknown) => void,
): RateLimiter | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return createUpstashRateLimiter(new Redis({ url, token }), onError);
}

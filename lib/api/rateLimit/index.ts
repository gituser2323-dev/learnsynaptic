import type { RateLimiter } from "./types";
import { inMemoryRateLimiter } from "./inMemory";
import { createUpstashRateLimiterFromEnv } from "./upstash";

/**
 * Selects the process-wide RateLimiter.
 * Prefer Upstash when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are both set; otherwise keep the existing in-memory limiter.
 * Callers (withApiRoute) must not branch on provider — only RateLimiter.
 */
let cached: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (cached) return cached;
  const upstash = createUpstashRateLimiterFromEnv((err) => {
    // Lazy require to avoid circular import with logger modules.
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "rate_limit.upstash_error_fail_open",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  });
  cached = upstash ?? inMemoryRateLimiter;
  return cached;
}

/** Test-only: clear the singleton so env changes can be re-evaluated. */
export function resetRateLimiterForTests(): void {
  cached = null;
}

export type { RateLimitResult, RateLimiter } from "./types";
export { inMemoryRateLimiter } from "./inMemory";

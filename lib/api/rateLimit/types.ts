export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch ms when this key's window resets. */
  resetAt: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

import { inMemoryRateLimiter } from "./rateLimit/inMemory";
import { RateLimitedError } from "./errors";

/**
 * RC-9 — Full-System Validation, Load, Stress, Security & Failure
 * Testing. A second, independent rate-limit DIMENSION for the handful
 * of auth-adjacent routes that take a target email in the request body
 * (forgot-password, resend-verification, MFA email-OTP request,
 * register) — real, live-proven finding: `getClientIp()` (this file's
 * sibling `clientIp.ts`) trusts the client-supplied `X-Forwarded-For`
 * header with no trusted-proxy validation, a well-known, easily
 * exploited class of gap when there's no verified proxy boundary. A
 * live test against this app's own real running server confirmed 12/12
 * login attempts bypassed the existing per-IP rate limit by sending a
 * different spoofed X-Forwarded-For value on each request.
 *
 * Login itself already has a real, IP-independent secondary defense
 * (authService.ts's own per-account lockout, `MAX_FAILED_LOGIN_ATTEMPTS`)
 * that this exact bypass does NOT defeat — confirmed live, a locked
 * account stays locked regardless of which spoofed IP a request carries.
 * These four routes had no equivalent: a spoofed-IP attacker could
 * flood a single target's inbox with reset/verification/OTP emails, or
 * spam registration attempts, entirely unthrottled.
 *
 * Deliberately reuses the exact same `inMemoryRateLimiter` primitive
 * `withApiRoute.ts`'s own `rateLimit` option already uses — a second
 * KEY dimension (the target email, not the client IP), not a second
 * rate-limiting mechanism. Fails OPEN (never blocks) if no email can be
 * read from the body — the IP-keyed limit `withApiRoute` already
 * applies remains the floor in that case; this is additive
 * defense-in-depth, not a replacement for it.
 */
export async function assertEmailTargetRateLimitOk(
  routeName: string,
  rawEmail: unknown,
  limit: number,
  windowMs: number,
): Promise<void> {
  if (typeof rawEmail !== "string" || !rawEmail.trim()) return;
  const email = rawEmail.trim().toLowerCase();
  const result = await inMemoryRateLimiter.check(`${routeName}:email:${email}`, limit, windowMs);
  if (!result.allowed) {
    throw new RateLimitedError(Math.ceil((result.resetAt - Date.now()) / 1000));
  }
}

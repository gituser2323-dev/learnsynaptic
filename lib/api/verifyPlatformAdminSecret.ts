import { timingSafeEqual } from "crypto";
import { PLATFORM_ADMIN_SECRET, IS_PLATFORM_ADMIN_CONFIGURED } from "@/config/platformAdmin";

/**
 * Business OS Phase 8, Module 8.3 — the second half of the global Plan
 * catalog's write gate (the first half is `requiredRole: "admin"`,
 * checked by `withApiRoute` before a handler ever runs). Constant-time
 * comparison, same reasoning as `verifyCronSecret.ts`/the WhatsApp
 * webhook's own HMAC check: a naive `===` would leak timing
 * information. Fails closed if `PLATFORM_ADMIN_SECRET` isn't
 * configured — every Plan-write route stays fully inert rather than
 * falling back to an insecure default, the same posture
 * `isValidCronRequest()` already takes for its own secret.
 */
export function isValidPlatformAdminRequest(request: Request): boolean {
  if (!IS_PLATFORM_ADMIN_CONFIGURED) return false;

  const provided = request.headers.get("x-platform-admin-secret");
  if (!provided) return false;

  const expected = PLATFORM_ADMIN_SECRET;
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

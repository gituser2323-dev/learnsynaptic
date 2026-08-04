/**
 * Best-effort client IP extraction for rate-limiting keys. Route handlers
 * don't get a reliable `.ip` field on the standard Request object — the
 * hosting platform's proxy sets x-forwarded-for (Vercel and most others
 * do this correctly); x-real-ip is a fallback some proxies use instead.
 * "unknown" is a safe fallback, not an error: it just means every
 * request without either header shares one rate-limit bucket, which is
 * acceptable degraded behavior, not a crash.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

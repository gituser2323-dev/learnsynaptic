import { NextResponse } from "next/server";
import { verifyLocalSignedUrl } from "@/lib/services/storage/signedUrl";
import { readLocalFile } from "@/lib/services/storage/providers/local.provider";
import { buildContentDispositionHeader } from "@/lib/services/storage/validation";
import { inMemoryRateLimiter } from "@/lib/api/rateLimit/inMemory";
import { getClientIp } from "@/lib/api/clientIp";

/**
 * GET /api/files/local/[...key]?exp=...&sig=...&mime=...&filename=...
 *
 * File Storage (Phase 6), Module 6.2 — the LocalStorageProvider's own
 * signed-URL delivery endpoint. Deliberately NOT behind `withApiRoute`
 * / admin-session auth: a signed URL's whole point is time-limited
 * access without requiring the holder to be logged in (matching what
 * a real S3 presigned URL or Cloudinary delivery link already does) —
 * the HMAC signature + expiry check (verifyLocalSignedUrl, reusing
 * JWT_ACCESS_TOKEN_SECRET) is the access control here, not a session
 * cookie. Only ever reachable via a URL this app itself minted
 * (fileStorageService.getDownloadUrl → LocalStorageProvider.getSignedUrl)
 * — never a raw path an admin session could construct by guessing.
 *
 * RC-2 — two real hardening additions, not present when this route
 * only ever served `application/octet-stream` with no rate limiting:
 *  1. `mime`/`filename` are now part of the signed payload itself
 *     (verifyLocalSignedUrl returns them only once verified — see
 *     signedUrl.ts's own doc comment on why they're signed, not just
 *     trusted query params) and used to serve the file's own real
 *     Content-Type plus a real `Content-Disposition: attachment`
 *     header (buildContentDispositionHeader — safe against header
 *     injection from an attacker-controlled original filename) —
 *     "safe downloads," not an inert `octet-stream` label that still
 *     left every browser's own sniffing behavior undefined.
 *  2. A real per-IP rate limit — not behind `withApiRoute` (this route
 *     has no auth context to key a request-scoped rate limit off of
 *     any more meaningfully than IP), but the identical
 *     `inMemoryRateLimiter` primitive every other route already uses.
 */
const RATE_LIMIT = { limit: 120, windowMs: 60_000 };

export async function GET(request: Request, context: { params: Promise<{ key: string[] }> }): Promise<NextResponse> {
  const rateLimitResult = await inMemoryRateLimiter.check(`files.local.download:${getClientIp(request)}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, errors: [{ field: "root", message: "Too many requests. Please try again shortly." }] },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } },
    );
  }

  const { key } = await context.params;
  const storageKey = key.map((segment) => decodeURIComponent(segment)).join("/");

  const { searchParams } = new URL(request.url);
  const verified = verifyLocalSignedUrl(storageKey, searchParams.get("exp"), searchParams.get("sig"), searchParams.get("mime"), searchParams.get("filename"));
  if (!verified) {
    return NextResponse.json({ success: false, errors: [{ field: "sig", message: "Invalid or expired signed URL." }] }, { status: 403 });
  }

  try {
    const buffer = await readLocalFile(storageKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        // X-Content-Type-Options/CSP/etc. are already applied to every
        // route (including this one) by next.config.ts's own global
        // headers() — not repeated here.
        "Content-Type": verified.mimeType || "application/octet-stream",
        "Content-Disposition": buildContentDispositionHeader(verified.filename || storageKey),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "key", message: "File not found." }] }, { status: 404 });
  }
}

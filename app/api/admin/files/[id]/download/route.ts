import { NextResponse } from "next/server";
import { withApiRoute, NotFoundApiError, UpstreamServiceApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { fileStorageService, StorageProviderError } from "@/lib/services/storage";

/**
 * GET /api/admin/files/[id]/download
 *
 * File Storage (Phase 6), Module 6.2 — the one authenticated download
 * entry point: resolves whichever URL is correct for this file's
 * provider/visibility (a real public S3/Cloudinary URL, a real S3
 * presigned URL, or this app's own local-signed-URL route for the
 * local provider — see fileStorageService.getDownloadUrl's own doc
 * comment) and redirects the browser there. RBAC is enforced HERE,
 * before any URL is ever handed out — a private file's real location
 * is never returned to a client that isn't allowed to see it.
 *
 * ⚠️ requiredRole: "counsellor".
 */
async function handleDownload(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const file = await fileStorageService.getFile(id);
  if (!file || file.deletedAt) throw new NotFoundApiError("File", id);

  try {
    const url = await fileStorageService.getDownloadUrl(id);
    if (!url) throw new NotFoundApiError("File", id);
    // getDownloadUrl returns a relative path for the local provider
    // (see LocalStorageProvider/createLocalSignedUrl) but an absolute
    // one for S3/Cloudinary — NextResponse.redirect() requires an
    // absolute URL either way, so resolve against this request's own
    // origin; a URL that's already absolute passes through unchanged.
    return NextResponse.redirect(new URL(url, request.url));
  } catch (error) {
    if (error instanceof StorageProviderError) throw new UpstreamServiceApiError(error.message);
    throw error;
  }
}

export const GET = withApiRoute("admin.files.download", handleDownload, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

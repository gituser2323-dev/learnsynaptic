import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { fileStorageService } from "@/lib/services/storage";

/**
 * GET /api/admin/files/[id], DELETE /api/admin/files/[id]
 *
 * File Storage (Phase 6), Module 6.2 — metadata only (never a raw
 * credential or the provider's own internal storageKey construction
 * details beyond what's already public metadata). DELETE removes the
 * real bytes from the active provider immediately and soft-deletes the
 * metadata row — see fileStorageService.deleteFile's own doc comment.
 *
 * ⚠️ requiredRole: "counsellor" — same floor tier as the upload route.
 */
async function handleGetFile(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const file = await fileStorageService.getFile(id);
  if (!file || file.deletedAt) throw new NotFoundApiError("File", id);
  return apiSuccess({ file });
}

async function handleDeleteFile(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const deleted = await fileStorageService.deleteFile(id, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!deleted) throw new NotFoundApiError("File", id);
  return apiSuccess({ file: deleted });
}

export const GET = withApiRoute("admin.files.get", handleGetFile, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const DELETE = withApiRoute("admin.files.delete", handleDeleteFile, {
  requiredRole: "counsellor",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

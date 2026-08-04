import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError, PlanEntitlementRequiredApiError, UsageLimitExceededApiError, parsePaginationParams } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { fileStorageService } from "@/lib/services/storage";
import { EntitlementError } from "@/lib/services/billing";
import type { FileCategory, FileVisibility } from "@/lib/services/storage";

/** Business OS Phase 8, Module 8.3 — translates the one throwing
 *  failure mode `fileStorageService.uploadFile()` has (see that
 *  function's own doc comment) into the real, distinguishable HTTP
 *  status a billing-aware client needs: 402 for a usage-limit
 *  rejection, 403 for a missing plan capability — never both folded
 *  into the same generic 400 an ordinary validation failure gets. */
function translateEntitlementError(error: EntitlementError): never {
  if (error.code === "limit_exceeded") {
    const details = error.details as { current?: number; limit?: number | null } | undefined;
    throw new UsageLimitExceededApiError(error.message, details?.current ?? 0, details?.limit ?? null);
  }
  throw new PlanEntitlementRequiredApiError(error.message);
}

const FILE_CATEGORIES: FileCategory[] = [
  "IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "CSV", "AVATAR", "ORGANIZATION_ASSET",
  "WHATSAPP_MEDIA", "EMAIL_ATTACHMENT", "CRM_ATTACHMENT", "EXPORT", "OTHER",
];

/**
 * POST /api/admin/files, GET /api/admin/files
 *
 * File Storage (Phase 6), Module 6.2 — the ONE generic upload/list
 * endpoint every business module should call (WhatsApp compose media,
 * Lead attachments, future modules) rather than each inventing its own
 * upload route. `multipart/form-data`, the same convention the CSV
 * import routes already established (see app/api/admin/crm/import).
 *
 * Every real security control lives in `fileStorageService
 * .uploadFile()`/`validateUpload()` — size limits, MIME/extension
 * allowlisting, magic-byte sniffing, filename sanitization, a
 * storageKey that's never derived from client input. This route's own
 * job is just RBAC + parsing the multipart body into that call.
 *
 * ⚠️ requiredRole: "counsellor" — the floor tier already used for
 * Leads/Activities (a counsellor must be able to attach a file to
 * their own lead); a real ownership check for the specific related
 * entity, where one applies, is the calling module's own job (the same
 * split Leads/Activities routes already use — this route doesn't know
 * what a "Lead" or "Conversation" is).
 */
async function handleUpload(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new ValidationApiError([{ field: "root", message: "Request body must be multipart/form-data." }]);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new ValidationApiError([{ field: "file", message: 'A file is required (form field name: "file").' }]);
  }

  const category = formData.get("category");
  if (typeof category !== "string" || !FILE_CATEGORIES.includes(category as FileCategory)) {
    throw new ValidationApiError([{ field: "category", message: `category must be one of: ${FILE_CATEGORIES.join(", ")}.` }]);
  }

  const visibilityRaw = formData.get("visibility");
  const visibility: FileVisibility = visibilityRaw === "public" ? "public" : "private";

  const relatedEntityType = formData.get("relatedEntityType");
  const relatedEntityId = formData.get("relatedEntityId");

  const buffer = Buffer.from(await file.arrayBuffer());
  let result;
  try {
    result = await fileStorageService.uploadFile(
      {
        buffer,
        originalFilename: file.name || "upload",
        mimeType: file.type || "application/octet-stream",
        category: category as FileCategory,
        visibility,
        uploadedBy: ctx.authContext.userId,
        relatedEntityType: typeof relatedEntityType === "string" ? relatedEntityType : undefined,
        relatedEntityId: typeof relatedEntityId === "string" ? relatedEntityId : undefined,
      },
      { actorId: ctx.authContext.userId, requestId: ctx.requestId },
    );
  } catch (error) {
    if (error instanceof EntitlementError) translateEntitlementError(error);
    throw error;
  }

  if (!result.success) throw new ValidationApiError(result.errors);
  return apiSuccess({ file: result.file }, 201);
}

async function handleListFiles(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const category = searchParams.get("category");
  const result = await fileStorageService.listFiles(
    {
      relatedEntityType: searchParams.get("relatedEntityType") || undefined,
      relatedEntityId: searchParams.get("relatedEntityId") || undefined,
      category: category && FILE_CATEGORIES.includes(category as FileCategory) ? (category as FileCategory) : undefined,
    },
    page,
    limit,
  );
  return apiSuccess({ ...result });
}

export const POST = withApiRoute("admin.files.upload", handleUpload, {
  requiredRole: "counsellor",
  // Business OS Phase 8, Module 8.3 — route-level capability gate,
  // on top of (not instead of) fileStorageService.uploadFile()'s own
  // deeper storage_bytes limit check.
  requiredCapability: "file_storage",
  // Real bytes cross the wire and a real vendor call may follow —
  // tighter than a plain CRUD route, same posture as AI-analysis routes.
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const GET = withApiRoute("admin.files.list", handleListFiles, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

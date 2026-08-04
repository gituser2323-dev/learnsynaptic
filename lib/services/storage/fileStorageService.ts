import { createHash } from "crypto";
import { getFileAssetRepository } from "@/lib/db";
import { integrationService } from "@/lib/services/integrations";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { getTenantContext } from "@/lib/tenancy/context";
import { entitlementService, usageService, LIFETIME_USAGE_PERIOD, EntitlementError } from "@/lib/services/billing";
import { getActiveStorageProviderId, getStorageProvider } from "./registry";
import { validateUpload, sanitizeFilename, getExtension, generateStorageKey } from "./validation";
import { StorageProviderNotConnectedError } from "./errors";
import { virusScanService } from "./virusScan/virusScanService";
import type { PaginatedResult } from "@/lib/pagination";
import type { FileAsset, FileAssetListFilters, FileCategory, FileVisibility } from "./types";

export interface UploadFileInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  category: FileCategory;
  visibility: FileVisibility;
  uploadedBy?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  organizationId?: string;
}

export type UploadFileResult = { success: true; file: FileAsset } | { success: false; errors: { field: string; message: string }[] };

/**
 * File Storage (Phase 6), Module 6.2 — the ONE place every business
 * module calls to upload/read/delete a file, regardless of which
 * StorageProvider is active. Reuses Module 6.1's Integrations Registry
 * directly for non-local providers rather than building a second
 * config/health system: `STORAGE_PROVIDER` picks which adapter's code
 * runs (same shape as WHATSAPP_PROVIDER/EMAIL_PROVIDER/AI_PROVIDER),
 * but AWS S3/Cloudinary additionally require an admin to have
 * connected *and* enabled them via Settings → Integrations first — a
 * real kill-switch without redeploying, and the same "connect and
 * enable" gate 6.1 already built for every other non-builtIn provider.
 * "local" needs no such gate — it has no external account to connect.
 */
async function assertProviderReady(providerId: string): Promise<void> {
  if (providerId === "local") return;
  const integration = await integrationService.getIntegration(providerId);
  if (!integration || integration.status !== "connected" || !integration.enabled) {
    throw new StorageProviderNotConnectedError(providerId as "aws_s3" | "cloudinary");
  }
}

export const fileStorageService = {
  async uploadFile(input: UploadFileInput, context: AuditContext = {}): Promise<UploadFileResult> {
    const validation = validateUpload({
      buffer: input.buffer,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      category: input.category,
    });
    if (!validation.valid) return { success: false, errors: validation.errors };

    // RC-2 — File Security: scanned before it ever reaches a provider
    // or an entitlement/quota check (never spend usage on a rejected
    // upload). Fails CLOSED, the same discipline every other real
    // security gate in this app applies (webhook signatures, the cron
    // secret): a scanner that couldn't complete is treated as unsafe,
    // not silently let through — see virusScan/types.ts's own doc
    // comment on why "infected" and "scan_failed" are both rejections,
    // just with distinguishable messages.
    const scanResult = await virusScanService.scanBuffer(input.buffer);
    if (scanResult.status === "infected") {
      return { success: false, errors: [{ field: "file", message: "This file was flagged as potentially malicious and was not uploaded." }] };
    }
    if (scanResult.status === "scan_failed") {
      return { success: false, errors: [{ field: "file", message: "This file could not be scanned right now. Please try again shortly." }] };
    }

    const providerId = getActiveStorageProviderId();
    await assertProviderReady(providerId);

    // Business OS Phase 8, Module 8.3 — server-enforced BEFORE any real
    // upload attempt (never a partially-executed paid action). Storage
    // is a STOCK metric (total bytes currently stored, not a per-period
    // count — see usageService.ts's own `LIFETIME_USAGE_PERIOD` doc
    // comment), so the check/increment amount is real file size, not a
    // flat "1 per upload." Uses `input.organizationId` directly (this
    // function's own existing explicit parameter, already resolved by
    // its caller) rather than re-reading ambient tenant context.
    //
    // Deliberately THROWS `EntitlementError` here rather than folding
    // it into this function's own `{success:false, errors}` return
    // shape (unlike every other validation failure above/below) — this
    // is the one caller of this function (app/api/admin/files/route.ts)
    // and it needs to distinguish "your plan doesn't include this"
    // (403) from "you're over your storage limit" (402) from an
    // ordinary 400 validation failure, the same real distinction
    // `withApiRoute.ts`'s own `requiredCapability` gate already makes
    // for capability checks. A future second caller of this function
    // that can't make that HTTP-shaped distinction can simply try/catch
    // EntitlementError itself.
    const organizationId = input.organizationId ?? getTenantContext()?.organizationId;
    if (organizationId) {
      await entitlementService.assertCapability(organizationId, "file_storage");
      const usage = await usageService.checkAndIncrementUsage(organizationId, "storage_bytes", input.buffer.length, LIFETIME_USAGE_PERIOD);
      if (!usage.allowed) {
        throw new EntitlementError("limit_exceeded", `Storage limit reached (${usage.current}/${usage.limit} bytes). Delete files or upgrade your plan.`, {
          organizationId,
          metric: "storage_bytes",
          current: usage.current,
          limit: usage.limit,
        });
      }
    }

    const extension = getExtension(input.originalFilename);
    const storageKey = generateStorageKey(input.category, extension);
    const storedFilename = sanitizeFilename(input.originalFilename);
    const checksum = createHash("sha256").update(input.buffer).digest("hex");

    const provider = getStorageProvider(providerId);
    const uploadResult = await provider.upload({
      storageKey,
      buffer: input.buffer,
      mimeType: input.mimeType,
      visibility: input.visibility,
    });

    if (providerId !== "local") {
      await integrationService.recordSync(providerId, "success", `Uploaded ${input.category} file (${input.buffer.length} bytes).`);
    }

    const repository = await getFileAssetRepository();
    const file = await repository.create({
      provider: providerId,
      storageKey: uploadResult.storageKey,
      originalFilename: input.originalFilename,
      storedFilename,
      mimeType: input.mimeType,
      extension,
      sizeBytes: input.buffer.length,
      category: input.category,
      checksum,
      visibility: input.visibility,
      publicUrl: uploadResult.publicUrl,
      uploadedBy: input.uploadedBy,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      organizationId: input.organizationId,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.FILE_UPLOADED,
      entityType: "File",
      entityId: file.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { category: file.category, provider: file.provider, sizeBytes: file.sizeBytes },
    });

    return { success: true, file };
  },

  async getFile(id: string): Promise<FileAsset | null> {
    const repository = await getFileAssetRepository();
    return repository.findById(id);
  },

  async listFiles(filters: FileAssetListFilters, page = 1, limit = 20): Promise<PaginatedResult<FileAsset>> {
    const repository = await getFileAssetRepository();
    return repository.list(filters, page, limit);
  },

  async deleteFile(id: string, context: AuditContext = {}): Promise<FileAsset | null> {
    const repository = await getFileAssetRepository();
    const file = await repository.findById(id);
    if (!file || file.deletedAt) return null;

    const provider = getStorageProvider(file.provider);
    try {
      await provider.delete(file.storageKey);
      if (file.provider !== "local") {
        await integrationService.recordSync(file.provider, "success", `Deleted ${file.category} file.`);
      }
    } catch (error) {
      if (file.provider !== "local") {
        await integrationService.recordSync(file.provider, "failure", error instanceof Error ? error.message : "delete failed");
      }
      throw error;
    }

    const deleted = await repository.softDelete(id);

    const organizationId = file.organizationId ?? getTenantContext()?.organizationId;
    if (organizationId) {
      await usageService.incrementUsage(organizationId, "storage_bytes", -file.sizeBytes, LIFETIME_USAGE_PERIOD);
    }

    await auditLogService.record({
      action: AUDIT_ACTIONS.FILE_DELETED,
      entityType: "File",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { category: file.category, provider: file.provider },
    });
    return deleted;
  },

  /** Public files: the provider's own real URL when one exists (S3/
   *  Cloudinary), or this file's own signed URL as a fallback (local —
   *  see LocalStorageProvider's own doc comment on why it has no real
   *  public host). Private files: always a signed/expiring URL — never
   *  the raw public delivery path, and this throws for Cloudinary
   *  private files rather than silently exposing them (see
   *  CloudinaryStorageProvider's own disclosed gap). */
  async getDownloadUrl(id: string, expiresInSeconds = 300): Promise<string | null> {
    const file = await this.getFile(id);
    if (!file || file.deletedAt) return null;

    const provider = getStorageProvider(file.provider);
    if (file.visibility === "public" && file.publicUrl) return file.publicUrl;
    return provider.getSignedUrl(file.storageKey, expiresInSeconds, { mimeType: file.mimeType, filename: file.originalFilename });
  },
};

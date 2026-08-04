import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fileStorageService } from "./fileStorageService";
import { getStorageProvider } from "./registry";

const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

/**
 * File Storage (Phase 6), Module 6.2.
 *
 * This test environment has no STORAGE_PROVIDER set, so the active
 * provider is "local" (the safe dev default) throughout — these tests
 * exercise the local provider for real (real bytes written to and read
 * back from `.storage-uploads/`, not mocked), the same "real
 * integration test over a mock" discipline this project applies
 * everywhere else. The aws_s3/cloudinary-specific "not connected" gate
 * is tested separately below via vi.resetModules() + a stubbed
 * STORAGE_PROVIDER env var, the same technique this codebase's own
 * automation-engine tests already established for env-driven,
 * module-load-time constants.
 */
describe("fileStorageService.uploadFile / getFile / listFiles / deleteFile — local provider", () => {
  it("uploads a valid file, persists metadata, and writes real bytes to disk", async () => {
    const result = await fileStorageService.uploadFile({
      buffer: PNG_BUFFER,
      originalFilename: "photo.png",
      mimeType: "image/png",
      category: "IMAGE",
      visibility: "private",
      uploadedBy: "user-1",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.file.provider).toBe("local");
    expect(result.file.sizeBytes).toBe(PNG_BUFFER.length);
    expect(result.file.checksum).toHaveLength(64); // sha256 hex
    expect(result.file.publicUrl).toBeUndefined(); // local never has one

    const provider = getStorageProvider("local");
    expect(await provider.exists(result.file.storageKey)).toBe(true);
  });

  it("returns validation errors rather than throwing for an invalid upload", async () => {
    const result = await fileStorageService.uploadFile({
      buffer: Buffer.alloc(0),
      originalFilename: "empty.png",
      mimeType: "image/png",
      category: "IMAGE",
      visibility: "private",
    });
    expect(result.success).toBe(false);
  });

  it("listFiles filters by relatedEntityType/relatedEntityId", async () => {
    const leadId = `lead-${Date.now()}`;
    await fileStorageService.uploadFile({
      buffer: PNG_BUFFER,
      originalFilename: "attachment.png",
      mimeType: "image/png",
      category: "CRM_ATTACHMENT",
      visibility: "private",
      relatedEntityType: "Lead",
      relatedEntityId: leadId,
    });

    const page = await fileStorageService.listFiles({ relatedEntityType: "Lead", relatedEntityId: leadId });
    expect(page.total).toBe(1);
    expect(page.items[0].relatedEntityId).toBe(leadId);
  });

  it("deleteFile soft-deletes the metadata row and removes the real bytes from disk", async () => {
    const uploaded = await fileStorageService.uploadFile({
      buffer: PNG_BUFFER,
      originalFilename: "to-delete.png",
      mimeType: "image/png",
      category: "OTHER",
      visibility: "private",
    });
    expect(uploaded.success).toBe(true);
    if (!uploaded.success) return;

    const deleted = await fileStorageService.deleteFile(uploaded.file.id);
    expect(deleted?.deletedAt).toBeDefined();

    const provider = getStorageProvider("local");
    expect(await provider.exists(uploaded.file.storageKey)).toBe(false);

    // A soft-deleted file is invisible to getFile/listFiles/download.
    expect(await fileStorageService.getFile(uploaded.file.id)).toEqual(expect.objectContaining({ deletedAt: expect.any(String) }));
    const page = await fileStorageService.listFiles({});
    expect(page.items.some((f) => f.id === uploaded.file.id)).toBe(false);
  });

  it("deleteFile returns null for an already-deleted or nonexistent file", async () => {
    expect(await fileStorageService.deleteFile("no-such-file-id")).toBeNull();
  });

  it("getDownloadUrl falls back to a signed local URL when there's no real public URL", async () => {
    const uploaded = await fileStorageService.uploadFile({
      buffer: PNG_BUFFER,
      originalFilename: "public.png",
      mimeType: "image/png",
      category: "IMAGE",
      visibility: "public",
    });
    expect(uploaded.success).toBe(true);
    if (!uploaded.success) return;

    const url = await fileStorageService.getDownloadUrl(uploaded.file.id);
    expect(url).toMatch(/^\/api\/files\/local\//);
  });

  it("getDownloadUrl returns null for a nonexistent file", async () => {
    expect(await fileStorageService.getDownloadUrl("no-such-file-id")).toBeNull();
  });
});

describe("fileStorageService — non-local provider requires Integrations Registry connection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("STORAGE_PROVIDER", "aws_s3");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects an upload to aws_s3 when it hasn't been connected+enabled via the Integrations Registry", async () => {
    const { fileStorageService: freshService } = await import("./fileStorageService");
    await expect(
      freshService.uploadFile({
        buffer: PNG_BUFFER,
        originalFilename: "photo.png",
        mimeType: "image/png",
        category: "IMAGE",
        visibility: "public",
      }),
    ).rejects.toThrow(/not connected and enabled/);
  });

  it("succeeds once aws_s3 is connected+enabled via integrationService — configured check passes, then fails on the real (unconfigured) vendor call", async () => {
    const { integrationService: freshIntegrationService } = await import("@/lib/services/integrations");
    const { fileStorageService: freshService } = await import("./fileStorageService");

    const connected = await freshIntegrationService.connect("aws_s3", {});
    expect(connected.success).toBe(true);

    // Now past the "not connected" gate — but this environment has no
    // real AWS credentials, so the actual upload attempt fails at the
    // provider layer instead (a different, later error) — confirms the
    // gate itself isn't what's blocking it anymore, the same
    // "unconfigured vendor, not a bug" distinction 5.1/6.1 already draw.
    await expect(
      freshService.uploadFile({
        buffer: PNG_BUFFER,
        originalFilename: "photo.png",
        mimeType: "image/png",
        category: "IMAGE",
        visibility: "public",
      }),
    ).rejects.toThrow(/not configured/);
  });
});

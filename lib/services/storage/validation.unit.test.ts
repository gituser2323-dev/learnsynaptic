import { describe, it, expect } from "vitest";
import { validateUpload, sanitizeFilename, getExtension, generateStorageKey, claimedTypeMatchesContent } from "./validation";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe("validateUpload", () => {
  it("accepts a well-formed image within size/type limits", () => {
    const result = validateUpload({ buffer: PNG_HEADER, originalFilename: "photo.png", mimeType: "image/png", category: "IMAGE" });
    expect(result.valid).toBe(true);
  });

  it("rejects a file exceeding its category's size limit", () => {
    const oversized = Buffer.alloc(11 * 1024 * 1024);
    PNG_HEADER.copy(oversized);
    const result = validateUpload({ buffer: oversized, originalFilename: "big.png", mimeType: "image/png", category: "IMAGE" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.message.includes("10MB limit"))).toBe(true);
  });

  it("rejects an empty file", () => {
    const result = validateUpload({ buffer: Buffer.alloc(0), originalFilename: "empty.png", mimeType: "image/png", category: "IMAGE" });
    expect(result.valid).toBe(false);
  });

  it("rejects a MIME type not allowed for the category", () => {
    const result = validateUpload({ buffer: PNG_HEADER, originalFilename: "photo.exe", mimeType: "video/mp4", category: "IMAGE" });
    expect(result.valid).toBe(false);
  });

  it.each(["evil.exe", "script.sh", "payload.php", "malware.jar"])("rejects a dangerous extension: %s", (filename) => {
    const result = validateUpload({ buffer: PNG_HEADER, originalFilename: filename, mimeType: "application/octet-stream", category: "OTHER" });
    expect(result.valid).toBe(false);
  });

  it("rejects a dangerous declared MIME type even with a safe-looking extension", () => {
    const result = validateUpload({ buffer: PNG_HEADER, originalFilename: "notes.txt", mimeType: "application/x-msdownload", category: "OTHER" });
    expect(result.valid).toBe(false);
  });

  it("rejects content that doesn't match its declared MIME type (magic-byte mismatch)", () => {
    // Declares image/png but the actual bytes are a JPEG signature.
    const result = validateUpload({ buffer: JPEG_HEADER, originalFilename: "fake.png", mimeType: "image/png", category: "IMAGE" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.field === "mimeType")).toBe(true);
  });

  it("does not fail magic-byte sniffing for a MIME type with no known signature (best-effort, not exhaustive)", () => {
    const result = validateUpload({ buffer: Buffer.from("id,name\n1,test"), originalFilename: "leads.csv", mimeType: "text/csv", category: "CSV" });
    expect(result.valid).toBe(true);
  });
});

describe("sanitizeFilename", () => {
  it("strips path separators, keeping only the basename", () => {
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("/");
    expect(sanitizeFilename("C:\\Windows\\System32\\evil.exe")).toBe("evil.exe");
  });

  it("strips control characters and '..' sequences", () => {
    expect(sanitizeFilename("na\x00me..txt")).not.toMatch(/[\x00-\x1f]/);
    expect(sanitizeFilename("../../file.txt")).not.toContain("..");
  });

  it("falls back to a safe default for a name that sanitizes to nothing", () => {
    expect(sanitizeFilename("../..")).toBe("file");
  });
});

describe("getExtension", () => {
  it("extracts a lowercase extension", () => {
    expect(getExtension("Photo.PNG")).toBe("png");
    expect(getExtension("no-extension")).toBe("");
  });
});

describe("generateStorageKey", () => {
  it("never incorporates the original filename — the real path-traversal defense", () => {
    const key = generateStorageKey("IMAGE", "png");
    expect(key).toMatch(/^image\/[0-9a-f-]{36}\.png$/);
  });

  it("generates a unique key on every call", () => {
    const a = generateStorageKey("DOCUMENT", "pdf");
    const b = generateStorageKey("DOCUMENT", "pdf");
    expect(a).not.toBe(b);
  });
});

describe("claimedTypeMatchesContent", () => {
  it("confirms a real PNG signature", () => {
    expect(claimedTypeMatchesContent(PNG_HEADER, "image/png")).toBe(true);
  });

  it("rejects a mismatched signature", () => {
    expect(claimedTypeMatchesContent(JPEG_HEADER, "image/png")).toBe(false);
  });

  it("passes (no verdict) for a MIME type with no known signature", () => {
    expect(claimedTypeMatchesContent(Buffer.from("plain text"), "text/plain")).toBe(true);
  });
});

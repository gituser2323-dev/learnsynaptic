import { randomUUID } from "crypto";
import type { FileCategory } from "./types";

/**
 * File Storage (Phase 6), Module 6.2 — every real safety control the
 * module's own mission calls out: size limits, MIME/extension
 * allowlisting, a hard dangerous-type blocklist, filename
 * sanitization, and a path-traversal defense that doesn't depend on
 * sanitization being perfect (see generateStorageKey's own comment).
 */

export interface FileValidationError {
  field: string;
  message: string;
}

const MAX_SIZE_BYTES_BY_CATEGORY: Record<FileCategory, number> = {
  IMAGE: 10 * 1024 * 1024,
  VIDEO: 50 * 1024 * 1024,
  AUDIO: 20 * 1024 * 1024,
  DOCUMENT: 20 * 1024 * 1024,
  CSV: 10 * 1024 * 1024,
  AVATAR: 5 * 1024 * 1024,
  ORGANIZATION_ASSET: 5 * 1024 * 1024,
  WHATSAPP_MEDIA: 16 * 1024 * 1024, // matches Meta's own real Cloud API media size ceiling
  EMAIL_ATTACHMENT: 10 * 1024 * 1024,
  CRM_ATTACHMENT: 20 * 1024 * 1024,
  EXPORT: 50 * 1024 * 1024,
  OTHER: 10 * 1024 * 1024,
};

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/3gpp"];
const AUDIO_MIME_TYPES = ["audio/mpeg", "audio/ogg", "audio/mp4", "audio/amr", "audio/aac"];
const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];
const CSV_MIME_TYPES = ["text/csv", "application/vnd.ms-excel", "text/plain"];

const ALLOWED_MIME_TYPES_BY_CATEGORY: Record<FileCategory, string[]> = {
  IMAGE: IMAGE_MIME_TYPES,
  VIDEO: VIDEO_MIME_TYPES,
  AUDIO: AUDIO_MIME_TYPES,
  DOCUMENT: DOCUMENT_MIME_TYPES,
  CSV: CSV_MIME_TYPES,
  AVATAR: ["image/png", "image/jpeg", "image/webp"],
  ORGANIZATION_ASSET: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  // WhatsApp's own real Cloud API accepts image/video/audio/document
  // under one message envelope — mirrored here rather than invented.
  WHATSAPP_MEDIA: [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES, ...AUDIO_MIME_TYPES, ...DOCUMENT_MIME_TYPES],
  EMAIL_ATTACHMENT: [...DOCUMENT_MIME_TYPES, ...IMAGE_MIME_TYPES],
  CRM_ATTACHMENT: [...DOCUMENT_MIME_TYPES, ...IMAGE_MIME_TYPES, ...CSV_MIME_TYPES],
  EXPORT: ["text/csv", "application/json", "application/pdf"],
  // OTHER still goes through the dangerous-type blocklist below — an
  // open category isn't the same as an unvalidated one.
  OTHER: [],
};

/** Always rejected, regardless of category — executable/script content
 *  masquerading as an upload. Checked by extension AND declared MIME,
 *  since either one alone is trivially spoofable by a client. */
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "bash", "php", "phtml", "php3", "php4", "php5",
  "js", "mjs", "jar", "msi", "dll", "com", "scr", "vbs", "vbe", "ps1", "psm1",
  "app", "apk", "deb", "rpm", "dmg", "wsf", "sys", "cpl", "hta",
]);
const DANGEROUS_MIME_TYPES = new Set([
  "application/x-msdownload",
  "application/x-sh",
  "application/x-executable",
  "text/x-php",
  "application/x-httpd-php",
  "application/javascript",
  "text/javascript",
  "application/x-java-archive",
]);

export function getExtension(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename);
  return match ? match[1].toLowerCase() : "";
}

/** Strips anything that could matter for a filesystem path or that a
 *  UI shouldn't render raw — but this is defense in depth only. The
 *  real path-traversal defense is that `storageKey` (see
 *  generateStorageKey below) is never built from this value at all. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const stripped = base
    .replace(/[\x00-\x1f]/g, "")
    .replace(/\.\./g, "")
    .trim();
  return (stripped || "file").slice(0, 200);
}

/** RC-2 — builds a safe `Content-Disposition` header VALUE for an
 *  arbitrary, attacker-influenced original filename (`FileAsset.
 *  originalFilename` is stored raw/unsanitized — see
 *  fileStorageService.uploadFile's own doc comment on why: it's a
 *  display value, `storedFilename`/`sanitizeFilename` above is the
 *  sanitized one). Interpolating a raw filename directly into a header
 *  string is a real header-injection vector (a filename containing a
 *  CRLF sequence or an unescaped `"` could inject additional response
 *  headers or break out of the quoted value) — this uses the RFC 6266/
 *  5987 `filename`+`filename*` pair instead of hand-rolled escaping:
 *  `filename=` carries a safe pure-ASCII fallback (quotes/backslashes/
 *  control characters stripped, non-ASCII replaced), `filename*=UTF-8''`
 *  carries the real name percent-encoded — percent-encoding makes every
 *  byte of it inert as header syntax, the standard, robust way to embed
 *  an arbitrary string in a header value at all, not just "escaped
 *  enough for the inputs tested so far." */
export function buildContentDispositionHeader(filename: string, disposition: "attachment" | "inline" = "attachment"): string {
  const asciiFallback = filename
    .replace(/[\x00-\x1f"\\]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .trim()
    .slice(0, 200) || "file";
  const encoded = encodeURIComponent(filename).slice(0, 400);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/** Every storage key is a fresh UUID, never derived from the client-
 *  supplied filename — the actual path-traversal defense, not just
 *  sanitization. A malicious filename like "../../etc/passwd" simply
 *  never reaches a path join anywhere in this module. */
export function generateStorageKey(category: FileCategory, extension: string): string {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const suffix = safeExtension ? `.${safeExtension}` : "";
  return `${category.toLowerCase()}/${randomUUID()}${suffix}`;
}

const MAGIC_NUMBERS: { mimeType: string; check: (buffer: Buffer) => boolean }[] = [
  { mimeType: "image/png", check: (b) => b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mimeType: "image/jpeg", check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mimeType: "image/gif", check: (b) => b.length >= 4 && b.subarray(0, 3).toString("ascii") === "GIF" },
  {
    mimeType: "image/webp",
    check: (b) => b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  { mimeType: "application/pdf", check: (b) => b.length >= 4 && b.subarray(0, 4).toString("ascii") === "%PDF" },
];

/** Best-effort — "do not trust the client-provided MIME type alone
 *  where stronger validation is feasible." Only a handful of formats
 *  have a simple, reliable magic-number signature; most audio/video
 *  codecs and plain text don't, so this can only ever reject a known
 *  mismatch, never positively confirm every type. Returns true (pass)
 *  whenever no signature check applies to the claimed MIME type — an
 *  absent check is not the same as a failed one. */
export function claimedTypeMatchesContent(buffer: Buffer, claimedMimeType: string): boolean {
  const rule = MAGIC_NUMBERS.find((r) => r.mimeType === claimedMimeType);
  if (!rule) return true;
  return rule.check(buffer);
}

export interface ValidateUploadInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  category: FileCategory;
}

export function validateUpload(input: ValidateUploadInput): { valid: true } | { valid: false; errors: FileValidationError[] } {
  const errors: FileValidationError[] = [];
  const extension = getExtension(input.originalFilename);

  if (DANGEROUS_EXTENSIONS.has(extension)) {
    errors.push({ field: "file", message: `Files with a ".${extension}" extension are not allowed.` });
  }
  if (DANGEROUS_MIME_TYPES.has(input.mimeType)) {
    errors.push({ field: "file", message: `Files of type "${input.mimeType}" are not allowed.` });
  }

  const allowedMimeTypes = ALLOWED_MIME_TYPES_BY_CATEGORY[input.category];
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(input.mimeType)) {
    errors.push({ field: "mimeType", message: `"${input.mimeType}" is not an allowed type for category ${input.category}.` });
  }

  const maxSize = MAX_SIZE_BYTES_BY_CATEGORY[input.category];
  if (input.buffer.length > maxSize) {
    errors.push({ field: "file", message: `File exceeds the ${Math.round(maxSize / (1024 * 1024))}MB limit for category ${input.category}.` });
  }
  if (input.buffer.length === 0) {
    errors.push({ field: "file", message: "File is empty." });
  }

  if (!claimedTypeMatchesContent(input.buffer, input.mimeType)) {
    errors.push({ field: "mimeType", message: `File content does not match its declared type "${input.mimeType}".` });
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

import { createHmac, timingSafeEqual } from "crypto";

/**
 * File Storage (Phase 6), Module 6.2 — the LocalStorageProvider's own
 * signed-URL scheme. Local dev has no real cloud CDN to ask for a
 * presigned URL the way S3 does, so this app signs its own: a time-
 * limited, tamper-proof token over `storageKey`, verified by a small
 * unauthenticated route (app/api/files/local/[...key]/route.ts) before
 * it ever reads a byte off disk. Reuses `JWT_ACCESS_TOKEN_SECRET` (a
 * real server secret never exposed to the client) rather than adding a
 * second secret env var for one narrow purpose.
 */
function getSigningSecret(): string {
  return process.env.JWT_ACCESS_TOKEN_SECRET || "dev-only-insecure-file-signing-secret";
}

/** RC-2 — `mimeType`/`filename` are now part of the SIGNED material,
 *  not read back from an untrusted query param: the delivery route
 *  needs the file's real declared mimeType and original filename to
 *  serve a correct Content-Type and a real `Content-Disposition:
 *  attachment; filename="..."` header (see that route's own doc
 *  comment for why forcing a download, rather than letting the browser
 *  render the response inline, is the real "safe downloads" control —
 *  Content-Type alone doesn't prevent that). Embedding them in the
 *  signature means a client can't swap in a different filename/type
 *  than the one this app itself generated the URL for. */
function sign(storageKey: string, expiresAt: number, mimeType: string, filename: string): string {
  return createHmac("sha256", getSigningSecret()).update(`${storageKey}:${expiresAt}:${mimeType}:${filename}`).digest("hex");
}

export interface LocalSignedUrlOptions {
  mimeType?: string;
  filename?: string;
}

export function createLocalSignedUrl(storageKey: string, expiresInSeconds: number, options: LocalSignedUrlOptions = {}): string {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const mimeType = options.mimeType ?? "";
  const filename = options.filename ?? "";
  const signature = sign(storageKey, expiresAt, mimeType, filename);
  const encodedKey = storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const params = new URLSearchParams({ exp: String(expiresAt), sig: signature });
  if (mimeType) params.set("mime", mimeType);
  if (filename) params.set("filename", filename);
  return `/api/files/local/${encodedKey}?${params.toString()}`;
}

export interface VerifiedLocalSignedUrl {
  mimeType?: string;
  filename?: string;
}

/** Returns the verified (tamper-checked) mimeType/filename on success,
 *  or null if the signature is missing, expired, or doesn't match —
 *  the caller must treat any of those identically (see the delivery
 *  route's own handling), never distinguishing which check failed. */
export function verifyLocalSignedUrl(
  storageKey: string,
  expiresAtParam: string | null,
  signatureParam: string | null,
  mimeTypeParam: string | null,
  filenameParam: string | null,
): VerifiedLocalSignedUrl | null {
  if (!expiresAtParam || !signatureParam) return null;
  const expiresAt = Number(expiresAtParam);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const mimeType = mimeTypeParam ?? "";
  const filename = filenameParam ?? "";
  const expected = sign(storageKey, expiresAt, mimeType, filename);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signatureParam, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  return { mimeType: mimeType || undefined, filename: filename || undefined };
}

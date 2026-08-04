import { createHash } from "crypto";
import { CLOUDINARY_CONFIG } from "@/config/storage";
import { STORAGE_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { StorageProviderNotConfiguredError, StorageProviderError } from "../errors";
import type { StorageProvider, StorageUploadInput, StorageUploadResult } from "../types";

/**
 * Real Cloudinary adapter — plain `fetch` + Node's own `crypto`, no SDK
 * dependency, matching this codebase's own established convention for
 * vendors with a simple, well-documented signing scheme (unlike S3's
 * genuinely complex SigV4, which does warrant the official SDK — see
 * awsS3.provider.ts's own comment). Cloudinary's upload signing is one
 * documented, stable algorithm: sort the params-to-sign alphabetically,
 * join as `key=value&key2=value2`, append the API secret, SHA1 it.
 *
 * Disclosed gap: `getSignedUrl` (private/"authenticated" delivery)
 * throws rather than guesses. Cloudinary's authenticated-delivery URL
 * signing has changed shape across SDK versions and this environment
 * has no real Cloudinary account to verify a hand-rolled implementation
 * against — the same "don't fabricate a security-relevant mechanism
 * you can't verify" discipline this project applies everywhere else.
 * Recommendation if Cloudinary is the chosen production vendor: use
 * AWS S3 (real presigned URLs, fully implemented) for private files,
 * or implement and verify Cloudinary's real scheme against a live
 * account before relying on it.
 */
function resourceTypeFor(mimeType: string): "image" | "video" | "raw" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return "video";
  return "raw";
}

function publicIdFor(storageKey: string): string {
  return storageKey.replace(/\.[^./]+$/, "");
}

function assertConfigured(): void {
  if (!CLOUDINARY_CONFIG.cloudName || !CLOUDINARY_CONFIG.apiKey || !CLOUDINARY_CONFIG.apiSecret) {
    throw new StorageProviderNotConfiguredError("cloudinary", "CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET must all be set");
  }
}

function signParams(params: Record<string, string>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${toSign}${CLOUDINARY_CONFIG.apiSecret}`).digest("hex");
}

export const cloudinaryStorageProvider: StorageProvider = {
  id: "cloudinary",

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    assertConfigured();
    const resourceType = resourceTypeFor(input.mimeType);
    const publicId = publicIdFor(input.storageKey);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const type = input.visibility === "public" ? "upload" : "authenticated";
    const signature = signParams({ public_id: publicId, timestamp, type });

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), input.storageKey);
    form.append("public_id", publicId);
    form.append("timestamp", timestamp);
    form.append("type", type);
    form.append("api_key", CLOUDINARY_CONFIG.apiKey);
    form.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(STORAGE_PROVIDER_TIMEOUT_MS),
    });
    const body = (await response.json()) as { secure_url?: string; error?: { message?: string } };
    if (!response.ok) throw new StorageProviderError("cloudinary", body.error?.message ?? `upload failed (${response.status})`);

    return { storageKey: input.storageKey, publicUrl: input.visibility === "public" ? body.secure_url : undefined };
  },

  async delete(storageKey: string): Promise<void> {
    assertConfigured();
    const publicId = publicIdFor(storageKey);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signParams({ public_id: publicId, timestamp });

    const form = new FormData();
    form.append("public_id", publicId);
    form.append("timestamp", timestamp);
    form.append("api_key", CLOUDINARY_CONFIG.apiKey);
    form.append("signature", signature);

    // resource_type is unknown at delete time without a DB lookup — try
    // "image" first (the common case), then "video"/"raw" on a miss.
    // Cloudinary returns 200 with result:"not found" rather than a real
    // HTTP error for a wrong resource_type, so this is a best-effort
    // ordering, not a guaranteed-correct one; disclosed, not hidden.
    for (const resourceType of ["image", "video", "raw"] as const) {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/destroy`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(STORAGE_PROVIDER_TIMEOUT_MS),
      });
      const body = (await response.json()) as { result?: string };
      if (body.result === "ok") return;
    }
  },

  async exists(storageKey: string): Promise<boolean> {
    assertConfigured();
    const publicId = publicIdFor(storageKey);
    const auth = Buffer.from(`${CLOUDINARY_CONFIG.apiKey}:${CLOUDINARY_CONFIG.apiSecret}`).toString("base64");
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/resources/image/upload/${encodeURIComponent(publicId)}`,
      { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(STORAGE_PROVIDER_TIMEOUT_MS) },
    );
    return response.ok;
  },

  getPublicUrl(storageKey: string): string | null {
    if (!CLOUDINARY_CONFIG.cloudName) return null;
    return `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/${publicIdFor(storageKey)}`;
  },

  async getSignedUrl(): Promise<string> {
    throw new StorageProviderError(
      "cloudinary",
      "private/authenticated delivery is not implemented for this provider — see this file's own doc comment. Use AWS S3 or the local provider for private files.",
    );
  },
};

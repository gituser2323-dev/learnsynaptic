import type { StorageProviderId } from "@/lib/services/storage/types";

/**
 * Single source of truth for File Storage (Phase 6, Module 6.2)
 * provider selection and credentials — server-only, never
 * NEXT_PUBLIC_*, the same shape config/whatsapp.ts / config/emailChannel.ts
 * / config/aiInsights.ts already established.
 *
 * Unlike those three (where the env var alone gates a "builtIn"
 * integration), AWS S3 and Cloudinary are also gated a second way: the
 * Integrations Registry (Module 6.1) must show them as "connected" AND
 * "enabled" before fileStorageService will actually route uploads to
 * them (see fileStorageService.ts's own doc comment). STORAGE_PROVIDER
 * only selects *which adapter's code* is active — the registry is the
 * real on/off switch for the two non-local ones. "local" needs no
 * registry connection at all, the same way Email's "console" needs no
 * external account — it's the safe, always-available dev default.
 */

const SUPPORTED_PROVIDER_IDS: readonly StorageProviderId[] = ["local", "aws_s3", "cloudinary"];

function resolveActiveProvider(): StorageProviderId {
  const raw = process.env.STORAGE_PROVIDER;
  if (raw && (SUPPORTED_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as StorageProviderId;
  }
  return "local";
}

export const STORAGE_ACTIVE_PROVIDER: StorageProviderId = resolveActiveProvider();

export const LOCAL_STORAGE_CONFIG = {
  /** Relative to the repo root; gitignored. Never served directly by
   *  Next.js static file handling (it's outside `public/`) — every
   *  local file is only ever reachable through the authenticated
   *  download route, see app/api/admin/files/[id]/download/route.ts. */
  directory: process.env.LOCAL_STORAGE_DIR || ".storage-uploads",
};

export const AWS_S3_CONFIG = {
  bucket: process.env.AWS_S3_BUCKET || "",
  region: process.env.AWS_S3_REGION || "",
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || "",
  /** Optional — a CDN/custom domain in front of the bucket. Falls back
   *  to the bucket's own virtual-hosted-style URL when unset. */
  publicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL || "",
};

export const CLOUDINARY_CONFIG = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  apiKey: process.env.CLOUDINARY_API_KEY || "",
  apiSecret: process.env.CLOUDINARY_API_SECRET || "",
};

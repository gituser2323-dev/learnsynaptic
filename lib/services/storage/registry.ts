import { STORAGE_ACTIVE_PROVIDER } from "@/config/storage";
import { localStorageProvider } from "./providers/local.provider";
import { awsS3StorageProvider } from "./providers/awsS3.provider";
import { cloudinaryStorageProvider } from "./providers/cloudinary.provider";
import type { StorageProvider, StorageProviderId } from "./types";

/**
 * The single seam where STORAGE_PROVIDER becomes a concrete
 * StorageProvider instance — the exact shape every other vendor
 * registry in this app already established (WhatsApp/Email/AI).
 * fileStorageService.ts is the only caller; nothing else should import
 * a concrete provider directly.
 */
const registry: Record<StorageProviderId, StorageProvider> = {
  local: localStorageProvider,
  aws_s3: awsS3StorageProvider,
  cloudinary: cloudinaryStorageProvider,
};

export function getActiveStorageProviderId(): StorageProviderId {
  return STORAGE_ACTIVE_PROVIDER;
}

export function getStorageProvider(id: StorageProviderId = STORAGE_ACTIVE_PROVIDER): StorageProvider {
  return registry[id];
}

import type { StorageProviderId } from "./types";

/** The active provider (per STORAGE_PROVIDER) has no real credentials
 *  configured — mirrors AiProviderNotConfiguredError's own "fail
 *  gracefully, this is the expected common case" posture, not a bug. */
export class StorageProviderNotConfiguredError extends Error {
  constructor(providerId: StorageProviderId, reason: string) {
    super(`Storage provider "${providerId}" is not configured: ${reason}.`);
    this.name = "StorageProviderNotConfiguredError";
  }
}

/** The active provider is configured (real credentials exist) but
 *  hasn't been connected+enabled through the Integrations Registry
 *  (Module 6.1) yet — the two-factor gate fileStorageService enforces
 *  for every non-local provider. */
export class StorageProviderNotConnectedError extends Error {
  constructor(providerId: StorageProviderId) {
    super(`Storage provider "${providerId}" is not connected and enabled — connect it in Settings → Integrations first.`);
    this.name = "StorageProviderNotConnectedError";
  }
}

/** A real upload/delete/signed-URL attempt against the vendor failed —
 *  distinct from "not configured"/"not connected", which are both
 *  known, expected states this app must degrade from gracefully. This
 *  is a genuine, unexpected vendor-side failure. */
export class StorageProviderError extends Error {
  constructor(providerId: StorageProviderId, message: string) {
    super(`Storage provider "${providerId}" error: ${message}`);
    this.name = "StorageProviderError";
  }
}

export class FileNotFoundError extends Error {
  constructor(id: string) {
    super(`File ${id} not found.`);
    this.name = "FileNotFoundError";
  }
}

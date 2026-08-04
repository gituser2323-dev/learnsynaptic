import { getVirusScanProvider } from "./registry";
import type { VirusScanResult } from "./types";

export type { VirusScanResult } from "./types";
export type { VirusScanProviderId } from "@/config/virusScan";

/**
 * RC-2 — File Security: the one entry point fileStorageService.
 * uploadFile() calls, regardless of which VirusScanProvider is active
 * (mirrors every other pluggable-vendor service in this app —
 * emailService/whatsappService/aiService — never a concrete provider
 * imported directly by a caller).
 */
export const virusScanService = {
  async scanBuffer(buffer: Buffer): Promise<VirusScanResult> {
    return getVirusScanProvider().scan(buffer);
  },
};
